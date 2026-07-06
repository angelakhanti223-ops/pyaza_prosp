from django.utils import timezone
from rest_framework import serializers

from accounts.serializers import UserSerializer
from integrations.models import UonRequestRecord, UonSyncLog
from integrations.serializers import UonRequestRecordSerializer

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

        validated_data.pop('consent')
        validated_data.setdefault('source', Lead.Source.SITE_FORM)
        validated_data['consent_personal_data_at'] = timezone.now()
        lead = super().create(validated_data)

        sync_lead_to_uon.delay(lead.id)
        send_lead_notification_task.delay(lead.id)
        if settings.SEND_LEAD_CONFIRMATION_EMAIL:
            send_lead_confirmation_task.delay(lead.id)

        return lead


# --- Мини-CRM (внутренняя панель, ТЗ 5) ---


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
    uon_request = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            'id', 'name', 'phone', 'email', 'source', 'source_display', 'direction', 'direction_name',
            'status', 'status_display', 'assigned_manager', 'deal_amount', 'commission', 'uon_ticket_id',
            'initial_comment', 'consent_personal_data_at', 'created_at', 'updated_at',
            'comments', 'status_history', 'attachments', 'tasks', 'uon_sync_logs', 'uon_request',
        ]

    def get_uon_request(self, obj):
        """Данные заявки из U-ON-зеркала — если заявка уже синхронизирована (панель
        на карточке заявки, не заменяет существующий рабочий процесс редактирования
        Lead — см. integrations.models.UonRequestRecord про то, почему это тот же
        объект, что и «обращение»/«сделка» в терминах U-ON)."""
        if not obj.uon_ticket_id:
            return None
        record = UonRequestRecord.objects.filter(uon_id=obj.uon_ticket_id).first()
        return UonRequestRecordSerializer(record).data if record else None


class LeadUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = ['status', 'assigned_manager', 'deal_amount', 'commission']
