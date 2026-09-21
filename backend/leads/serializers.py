from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from accounts.permissions import is_head
from accounts.serializers import UserSerializer
from integrations.models import UonLeadRecord, UonRequestRecord, UonSyncLog
from integrations.serializers import UonLeadRecordSerializer, UonRequestRecordSerializer

from .models import (
    Contact,
    Direction,
    Lead,
    LeadAttachment,
    LeadComment,
    LeadStatusHistory,
    LeadTag,
    TourOperator,
    TourOperatorExchangeRate,
)


TRAVEL_FIELDS = [
    'departure_city', 'departure_date', 'nights', 'adults', 'children_count', 'children_ages',
    'budget_from', 'budget_to', 'meal_type', 'hotel_wishes', 'next_contact_at',
]

PAYMENT_FIELDS = [
    'prepayment_amount', 'paid_amount', 'balance_due', 'full_payment_due_at',
    'tour_operator', 'tour_operator_ref', 'tour_currency', 'payment_exchange_rate',
    'booking_number', 'failure_reason',
]

OPERATOR_RATE_FIELDS = [
    'operator_current_rate', 'operator_current_rate_date', 'operator_rate_source_note',
    'operator_rate_direction', 'operator_rate_delta',
]

CRM_CONTROL_FIELDS = ['preferred_messenger', 'contact']


def _decimal_string(value):
    if value is None:
        return None
    return format(value, '.4f')


def _latest_operator_rate(obj, context):
    if not obj.tour_operator_ref_id:
        return None

    currency = obj.tour_currency or Lead.Currency.RUB
    if currency == Lead.Currency.RUB:
        return {'rate': Decimal('1.0000'), 'rate_date': timezone.localdate(), 'source_note': 'RUB'}

    cache = context.setdefault('_operator_rate_cache', {})
    key = (obj.tour_operator_ref_id, currency)
    if key not in cache:
        cache[key] = (
            TourOperatorExchangeRate.objects
            .filter(operator_id=obj.tour_operator_ref_id, currency=currency, is_active=True, rate_date__lte=timezone.localdate())
            .order_by('-rate_date')
            .first()
        )
    return cache[key]


def _rate_payload(obj, context):
    rate_obj = _latest_operator_rate(obj, context)
    if rate_obj is None:
        return {'current_rate': None, 'rate_date': None, 'source_note': '', 'direction': 'missing', 'delta': None}

    if isinstance(rate_obj, dict):
        current_rate = rate_obj['rate']
        rate_date = rate_obj['rate_date']
        source_note = rate_obj.get('source_note', '')
    else:
        current_rate = rate_obj.rate
        rate_date = rate_obj.rate_date
        source_note = rate_obj.source_note

    payment_rate = obj.payment_exchange_rate
    if current_rate is None or payment_rate is None:
        return {
            'current_rate': _decimal_string(current_rate),
            'rate_date': rate_date.isoformat() if rate_date else None,
            'source_note': source_note,
            'direction': 'missing',
            'delta': None,
        }

    delta = current_rate - payment_rate
    direction = 'higher' if delta > 0 else 'lower' if delta < 0 else 'same'
    return {
        'current_rate': _decimal_string(current_rate),
        'rate_date': rate_date.isoformat() if rate_date else None,
        'source_note': source_note,
        'direction': direction,
        'delta': _decimal_string(delta),
    }


def _split_name(full_name: str):
    parts = [part for part in (full_name or '').strip().split() if part]
    if len(parts) >= 3:
        return parts[0], parts[1], ' '.join(parts[2:])
    if len(parts) == 2:
        return parts[0], parts[1], ''
    if len(parts) == 1:
        return '', parts[0], ''
    return '', '', ''


def _sync_client_contact_from_lead(lead: Lead):
    last_name, first_name, middle_name = _split_name(lead.name)
    defaults = {
        'last_name': last_name,
        'first_name': first_name or lead.name,
        'middle_name': middle_name,
        'email_primary': lead.email or '',
        'phone_primary': lead.phone or '',
        'preferred_contact_method': lead.preferred_messenger or Contact.PreferredContactMethod.PHONE,
    }

    if lead.contact_id:
        Contact.objects.filter(id=lead.contact_id).update(**defaults)
        return

    contact = Contact.objects.create(**defaults)
    lead.contact = contact
    lead.save(update_fields=['contact'])


class DirectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Direction
        fields = ['id', 'name']


class TourOperatorExchangeRateSerializer(serializers.ModelSerializer):
    operator_name = serializers.CharField(source='operator.brand_name', read_only=True)

    class Meta:
        model = TourOperatorExchangeRate
        fields = ['id', 'operator', 'operator_name', 'currency', 'rate', 'rate_date', 'source_url', 'source_note', 'is_active', 'updated_at']


class TourOperatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = TourOperator
        fields = [
            'id', 'brand_name', 'legal_name', 'inn', 'ogrn', 'registry_number', 'activity_scope',
            'website', 'phone', 'email', 'address', 'payment_details', 'note', 'is_active',
        ]


class ContactSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    preferred_contact_method_display = serializers.CharField(source='get_preferred_contact_method_display', read_only=True)

    class Meta:
        model = Contact
        fields = [
            'id', 'last_name', 'first_name', 'middle_name', 'full_name', 'birth_date',
            'email_primary', 'email_secondary', 'phone_primary', 'phone_secondary', 'vk_profile',
            'preferred_contact_method', 'preferred_contact_method_display',
            'allow_email_marketing', 'allow_messenger_marketing', 'note', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'full_name', 'created_at', 'updated_at']


class LeadTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadTag
        fields = ['id', 'name', 'color', 'is_active']


class LeadCreateSerializer(serializers.ModelSerializer):
    consent = serializers.BooleanField(write_only=True)
    source = serializers.ChoiceField(choices=[Lead.Source.SITE_FORM, Lead.Source.CHATBOT], required=False)

    class Meta:
        model = Lead
        fields = ['id', 'name', 'phone', 'email', 'direction', 'initial_comment', 'consent', 'source']
        read_only_fields = ['id']

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError('Необходимо согласие на обработку персональных данных.')
        return value

    def create(self, validated_data):
        from django.conf import settings
        from emailing.tasks import send_lead_confirmation_task, send_lead_notification_task
        from integrations.tasks import sync_lead_to_uon
        from .tasks import create_new_lead_task

        validated_data.pop('consent')
        validated_data.setdefault('source', Lead.Source.SITE_FORM)
        validated_data['consent_personal_data_at'] = timezone.now()
        lead = super().create(validated_data)
        _sync_client_contact_from_lead(lead)

        sync_lead_to_uon.delay(lead.id)
        send_lead_notification_task.delay(lead.id)
        create_new_lead_task.delay(lead.id)
        if settings.SEND_LEAD_CONFIRMATION_EMAIL:
            send_lead_confirmation_task.delay(lead.id)
        return lead


class LeadCrmCreateSerializer(serializers.ModelSerializer):
    consent = serializers.BooleanField(write_only=True)

    class Meta:
        model = Lead
        fields = [
            'id', 'name', 'phone', 'email', 'direction', 'initial_comment', 'source',
            'assigned_manager', 'consent', *CRM_CONTROL_FIELDS, *TRAVEL_FIELDS,
        ]
        read_only_fields = ['id']

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError('Подтвердите, что согласие клиента на обработку персональных данных получено.')
        return value

    def validate_assigned_manager(self, value):
        request = self.context['request']
        if value and value != request.user and not is_head(request.user):
            raise serializers.ValidationError('Назначать заявку другому сотруднику может только руководитель.')
        return value

    def create(self, validated_data):
        from integrations.tasks import sync_lead_to_uon
        from telegrambot.tasks import notify_lead_assignment
        from .tasks import create_new_lead_task

        request = self.context['request']
        validated_data.pop('consent')
        validated_data.setdefault('source', Lead.Source.PHONE_CALL)
        validated_data.setdefault('assigned_manager', request.user)
        validated_data['consent_personal_data_at'] = timezone.now()
        lead = super().create(validated_data)
        _sync_client_contact_from_lead(lead)

        sync_lead_to_uon.delay(lead.id)
        create_new_lead_task.delay(lead.id)
        if lead.assigned_manager_id:
            notify_lead_assignment.delay(lead.id)
        return lead


class LeadCommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = LeadComment
        fields = ['id', 'author', 'text', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']


class LeadStatusHistorySerializer(serializers.ModelSerializer):
    changed_by = UserSerializer(read_only=True)
    old_status_display = serializers.CharField(source='get_old_status_display', read_only=True)
    new_status_display = serializers.CharField(source='get_new_status_display', read_only=True)

    class Meta:
        model = LeadStatusHistory
        fields = ['id', 'old_status', 'old_status_display', 'new_status', 'new_status_display', 'changed_by', 'changed_at']


class LeadAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)

    class Meta:
        model = LeadAttachment
        fields = ['id', 'file', 'uploaded_by', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_by', 'uploaded_at']


class LeadUonSyncLogSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = UonSyncLog
        fields = ['id', 'status', 'status_display', 'attempt_number', 'error_message', 'created_at']


class LeadTaskSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    column = serializers.CharField(source='column.name')
    deadline = serializers.DateTimeField()


class OperatorRateMixin(serializers.Serializer):
    operator_current_rate = serializers.SerializerMethodField()
    operator_current_rate_date = serializers.SerializerMethodField()
    operator_rate_source_note = serializers.SerializerMethodField()
    operator_rate_direction = serializers.SerializerMethodField()
    operator_rate_delta = serializers.SerializerMethodField()

    def _payload(self, obj):
        return _rate_payload(obj, self.context)

    def get_operator_current_rate(self, obj):
        return self._payload(obj)['current_rate']

    def get_operator_current_rate_date(self, obj):
        return self._payload(obj)['rate_date']

    def get_operator_rate_source_note(self, obj):
        return self._payload(obj)['source_note']

    def get_operator_rate_direction(self, obj):
        return self._payload(obj)['direction']

    def get_operator_rate_delta(self, obj):
        return self._payload(obj)['delta']


class LeadListSerializer(OperatorRateMixin, serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    preferred_messenger_display = serializers.CharField(source='get_preferred_messenger_display', read_only=True)
    direction_name = serializers.CharField(source='direction.name', read_only=True, default=None)
    assigned_manager = UserSerializer(read_only=True)
    tour_operator_details = TourOperatorSerializer(source='tour_operator_ref', read_only=True)
    contact_details = ContactSerializer(source='contact', read_only=True)
    tags = LeadTagSerializer(many=True, read_only=True)

    class Meta:
        model = Lead
        fields = [
            'id', 'contact', 'contact_details', 'name', 'phone', 'email',
            'preferred_messenger', 'preferred_messenger_display', 'tags',
            'status', 'status_display', 'source', 'source_display', 'direction', 'direction_name',
            'assigned_manager', 'deal_amount', 'commission', 'next_contact_at', 'departure_city',
            'departure_date', 'nights', 'budget_from', 'budget_to', 'prepayment_amount', 'paid_amount',
            'balance_due', 'full_payment_due_at', 'tour_operator', 'tour_operator_ref', 'tour_operator_details',
            'tour_currency', 'payment_exchange_rate', *OPERATOR_RATE_FIELDS,
            'booking_number', 'failure_reason', 'created_at',
        ]


class LeadDetailSerializer(OperatorRateMixin, serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    preferred_messenger_display = serializers.CharField(source='get_preferred_messenger_display', read_only=True)
    direction_name = serializers.CharField(source='direction.name', read_only=True, default=None)
    assigned_manager = UserSerializer(read_only=True)
    contact_details = ContactSerializer(source='contact', read_only=True)
    comments = LeadCommentSerializer(many=True, read_only=True)
    tags = LeadTagSerializer(many=True, read_only=True)
    status_history = LeadStatusHistorySerializer(many=True, read_only=True)
    attachments = LeadAttachmentSerializer(many=True, read_only=True)
    tasks = LeadTaskSerializer(many=True, read_only=True)
    uon_sync_logs = LeadUonSyncLogSerializer(many=True, read_only=True)
    uon_lead = serializers.SerializerMethodField()
    uon_request = serializers.SerializerMethodField()
    tour_operator_details = TourOperatorSerializer(source='tour_operator_ref', read_only=True)

    class Meta:
        model = Lead
        fields = [
            'id', 'contact', 'contact_details', 'name', 'phone', 'email',
            'preferred_messenger', 'preferred_messenger_display', 'tags',
            'source', 'source_display', 'direction', 'direction_name', 'status', 'status_display',
            'assigned_manager', 'deal_amount', 'commission', *TRAVEL_FIELDS, *PAYMENT_FIELDS,
            'tour_operator_details', *OPERATOR_RATE_FIELDS, 'uon_ticket_id', 'uon_request_id',
            'initial_comment', 'consent_personal_data_at', 'created_at', 'updated_at', 'comments',
            'status_history', 'attachments', 'tasks', 'uon_sync_logs', 'uon_lead', 'uon_request',
        ]

    def get_uon_lead(self, obj):
        if not obj.uon_ticket_id:
            return None
        record = UonLeadRecord.objects.filter(uon_id=obj.uon_ticket_id).first()
        return UonLeadRecordSerializer(record).data if record else None

    def get_uon_request(self, obj):
        if not obj.uon_request_id:
            return None
        record = UonRequestRecord.objects.filter(uon_id=obj.uon_request_id).first()
        return UonRequestRecordSerializer(record).data if record else None


class LeadUpdateSerializer(serializers.ModelSerializer):
    tag_ids = serializers.PrimaryKeyRelatedField(
        source='tags', queryset=LeadTag.objects.filter(is_active=True), many=True, required=False, write_only=True,
    )

    class Meta:
        model = Lead
        fields = [
            'name', 'phone', 'email', 'direction', 'initial_comment', 'status', 'assigned_manager',
            'deal_amount', 'commission', *CRM_CONTROL_FIELDS, *TRAVEL_FIELDS, *PAYMENT_FIELDS, 'tag_ids',
        ]

    def update(self, instance, validated_data):
        tags = validated_data.pop('tags', None)
        instance = super().update(instance, validated_data)
        if tags is not None:
            instance.tags.set(tags)
        _sync_client_contact_from_lead(instance)
        return instance
