from django.utils import timezone
from rest_framework import serializers

from accounts.permissions import is_head
from accounts.serializers import UserSerializer
from integrations.models import UonLeadRecord, UonSyncLog
from integrations.serializers import UonLeadRecordSerializer

from .models import Direction, Lead, LeadAttachment, LeadComment, LeadStatusHistory


class DirectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Direction
        fields = ['id', 'name']


class LeadCreateSerializer(serializers.ModelSerializer):
    consent = serializers.BooleanField(write_only=True)
    # Only site_form (default) or chatbot are reachable from this public endpoint —
    # phone_call/other are entered manually by staff, never by an anonymous request.
    source = serializers.ChoiceField(
        choices=[Lead.Source.SITE_FORM, Lead.Source.CHATBOT], required=False,
    )

    class Meta:
        model = Lead
        fields = ['id', 'name', 'phone', 'email', 'direction', 'initial_comment', 'consent', 'source']
        read_only_fields = ['id']

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError(
                'Необходимо согласие на обработку персональных данных.'
            )
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

        sync_lead_to_uon.delay(lead.id)
        send_lead_notification_task.delay(lead.id)
        create_new_lead_task.delay(lead.id)
        if settings.SEND_LEAD_CONFIRMATION_EMAIL:
            send_lead_confirmation_task.delay(lead.id)

        return lead


# --- Мини-CRM (внутренняя панель, ТЗ 5) ---


class LeadCrmCreateSerializer(serializers.ModelSerializer):
    """Ручное создание обращения сотрудником в CRM (например, со звонка) — те
    же поля, что уходят в U-ON при создании обращения (source/u_name/u_phone/
    u_email/note, см. integrations.adapters.build_ticket_payload), плюс
    направление и ответственный, которых нет в публичной форме сайта.

    consent остаётся обязательным полем и здесь: согласие на обработку ПДн
    нужно в любом случае, просто на этом пути его подтверждает сотрудник,
    получивший его на словах (по телефону), а не сам клиент чекбоксом."""

    consent = serializers.BooleanField(write_only=True)

    class Meta:
        model = Lead
        fields = ['id', 'name', 'phone', 'email', 'direction', 'initial_comment', 'source', 'assigned_manager', 'consent']
        read_only_fields = ['id']

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError(
                'Подтвердите, что согласие клиента на обработку персональных данных получено.'
            )
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
        fields = [
            'id', 'old_status', 'old_status_display', 'new_status', 'new_status_display',
            'changed_by', 'changed_at',
        ]


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
    """Лёгкое read-only представление связанной канбан-задачи для карточки заявки (ТЗ 5.4)."""

    id = serializers.IntegerField()
    title = serializers.CharField()
    column = serializers.CharField(source='column.name')
    deadline = serializers.DateTimeField()


class LeadListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    direction_name = serializers.CharField(source='direction.name', read_only=True, default=None)
    assigned_manager = UserSerializer(read_only=True)

    class Meta:
        model = Lead
        fields = [
            'id', 'name', 'phone', 'email', 'status', 'status_display', 'source', 'source_display',
            'direction', 'direction_name', 'assigned_manager', 'deal_amount', 'commission', 'created_at',
        ]


class LeadDetailSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    direction_name = serializers.CharField(source='direction.name', read_only=True, default=None)
    assigned_manager = UserSerializer(read_only=True)
    comments = LeadCommentSerializer(many=True, read_only=True)
    status_history = LeadStatusHistorySerializer(many=True, read_only=True)
    attachments = LeadAttachmentSerializer(many=True, read_only=True)
    tasks = LeadTaskSerializer(many=True, read_only=True)
    uon_sync_logs = LeadUonSyncLogSerializer(many=True, read_only=True)
    uon_lead = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            'id', 'name', 'phone', 'email', 'source', 'source_display', 'direction', 'direction_name',
            'status', 'status_display', 'assigned_manager', 'deal_amount', 'commission', 'uon_ticket_id',
            'initial_comment', 'consent_personal_data_at', 'created_at', 'updated_at',
            'comments', 'status_history', 'attachments', 'tasks', 'uon_sync_logs', 'uon_lead',
        ]

    def get_uon_lead(self, obj):
        """Данные обращения из U-ON-зеркала — если заявка уже синхронизирована (панель
        на карточке заявки, не заменяет существующий рабочий процесс редактирования
        Lead). Lead.uon_ticket_id — это ID обращения (lead) в U-ON, полученный при
        отправке через sync_lead_to_uon/create_ticket (POST /lead/create.json), а
        не ID заявки (request) — это разные сущности с разными ID в этом API."""
        if not obj.uon_ticket_id:
            return None
        record = UonLeadRecord.objects.filter(uon_id=obj.uon_ticket_id).first()
        return UonLeadRecordSerializer(record).data if record else None


class LeadUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = ['status', 'assigned_manager', 'deal_amount', 'commission']
