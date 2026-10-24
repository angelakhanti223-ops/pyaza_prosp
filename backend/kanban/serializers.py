from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.serializers import UserSerializer
from integrations.models import UonLeadRecord, UonRequestRecord

from .models import KanbanColumn, Task, TaskAttachment
from .services import column_for_status

User = get_user_model()


class KanbanColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = KanbanColumn
        fields = ['id', 'name', 'order', 'status']


class TaskAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)

    class Meta:
        model = TaskAttachment
        fields = ['id', 'file', 'uploaded_by', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_by', 'uploaded_at']


class TaskSerializer(serializers.ModelSerializer):
    assignee = UserSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        source='assignee', queryset=User.objects.all(), write_only=True, required=False, allow_null=True,
    )
    lead_name = serializers.CharField(source='lead.name', read_only=True, default=None)
    lead_status_display = serializers.CharField(source='lead.get_status_display', read_only=True, default=None)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    preferred_contact_channel_display = serializers.CharField(
        source='get_preferred_contact_channel_display', read_only=True,
    )
    uon_status_name = serializers.SerializerMethodField()
    kind = serializers.ReadOnlyField()
    priority = serializers.ReadOnlyField()
    attachments = TaskAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'status_display', 'column', 'assignee', 'assignee_id',
            'lead', 'lead_name', 'lead_status_display', 'deadline', 'is_recurring', 'kind', 'priority',
            'preferred_contact_channel', 'preferred_contact_channel_display',
            'uon_record_kind', 'uon_record_id', 'uon_status_name', 'attachments', 'order', 'created_at',
            'updated_at',
            'origin',
        ]
        read_only_fields = [
            'id', 'status_display', 'preferred_contact_channel_display', 'order', 'created_at', 'updated_at',
            'kind', 'priority', 'uon_record_kind', 'uon_record_id', 'attachments',
            'origin',
        ]

    def get_uon_status_name(self, obj):
        """Статус связанной записи U-ON (заявки/обращения), к которой привязана задача —
        для карточки на доске (ТЗ по требованию клиента, 31.08.2026), не путать с
        собственным статусом задачи (Task.status, ТЗ 01.09.2026) — это статус СВЯЗАННОЙ
        сущности, показывается рядом, без открытия её отдельно. TaskViewSet.list
        прогревает self.context прямо здесь (`uon_request_status`/`uon_lead_status` —
        словари uon_id → status_name) одним батч-запросом на весь список задач, чтобы не
        делать N+1; если словаря в context нет (retrieve/partial_update/move — там
        сериализатор строится без контекста), просто делаем один точечный запрос."""
        kind = obj.uon_record_kind
        if not kind or not obj.uon_record_id:
            return None

        prefetched = self.context.get(f'uon_{kind}_status')
        if prefetched is not None:
            return prefetched.get(obj.uon_record_id)

        model = UonRequestRecord if kind == 'request' else UonLeadRecord
        record = model.objects.filter(uon_id=obj.uon_record_id).only('status_name').first()
        return record.status_name if record else None


class TaskCreateSerializer(TaskSerializer):
    """POST /api/crm/kanban/tasks/ — в отличие от TaskSerializer (карточка/список,
    где uon_record_kind/uon_record_id только для чтения — их обычно расставляет
    синхронизация с U-ON), здесь их можно задать вручную. Это путь ручного создания
    задачи прямо с карточки обращения или заявки U-ON, у которой нет своего Lead в
    нашей базе (ТЗ по требованию клиента, 04.09.2026). uon_reminder_id сюда не
    входит и никогда не выставляется вручную — это ключ дедупликации синхронизации
    с U-ON, коллизия с ним задвоила бы будущий импорт того же напоминания."""

    class Meta(TaskSerializer.Meta):
        read_only_fields = [f for f in TaskSerializer.Meta.read_only_fields if f not in ('uon_record_kind', 'uon_record_id')]

    column = serializers.PrimaryKeyRelatedField(queryset=KanbanColumn.objects.filter(is_active=True, status__isnull=False), required=False)

    def validate(self, attrs):
        kind = attrs.get('uon_record_kind', '')
        record_id = attrs.get('uon_record_id', '')
        if bool(kind) != bool(record_id):
            raise serializers.ValidationError('uon_record_kind и uon_record_id нужно указывать вместе.')
        column = attrs.get('column')
        if column and 'status' in attrs and attrs['status'] != column.status:
            raise serializers.ValidationError('Статус задачи должен соответствовать колонке.')
        attrs['status'] = attrs.get('status', column.status if column else Task.Status.NEW)
        attrs['column'] = column or column_for_status(attrs['status'])
        return attrs


class TaskUpdateSerializer(serializers.ModelSerializer):
    """PATCH: edit task fields, but never column/order directly — use the move action instead."""

    assignee_id = serializers.PrimaryKeyRelatedField(
        source='assignee', queryset=User.objects.all(), write_only=True, required=False, allow_null=True,
    )
    expected_updated_at = serializers.DateTimeField(required=False, write_only=True)

    class Meta:
        model = Task
        fields = [
            'title', 'description', 'status', 'assignee_id', 'lead', 'deadline', 'is_recurring',
            'preferred_contact_channel',
            'expected_updated_at',
        ]

    def validate(self, attrs):
        if self.instance.origin == Task.Origin.NEXT_CONTACT:
            if attrs.get('is_recurring'):
                raise serializers.ValidationError('Следующий контакт планируется датой в заявке, без ежедневных копий.')
            if 'lead' in attrs and getattr(attrs['lead'], 'pk', None) != self.instance.lead_id:
                raise serializers.ValidationError('Задачу следующего контакта нельзя перенести в другую заявку.')
            if attrs.get('status') not in [None, Task.Status.DONE, Task.Status.CANCELLED] and self.instance.lead and self.instance.lead.status in ['closed_won', 'closed_lost', 'failed', 'not_target']:
                raise serializers.ValidationError('Для нового контакта сначала откройте заявку.')
        return attrs

    def update(self, instance, validated_data):
        instance._expected_updated_at = validated_data.pop('expected_updated_at', None)
        return super().update(instance, validated_data)


class TaskMoveSerializer(serializers.Serializer):
    column = serializers.PrimaryKeyRelatedField(queryset=KanbanColumn.objects.filter(is_active=True, status__isnull=False))
    order = serializers.IntegerField(min_value=0)
    expected_updated_at = serializers.DateTimeField(required=False)


class TaskFilterSerializer(serializers.Serializer):
    lead = serializers.IntegerField(required=False, min_value=1)
    assignee = serializers.IntegerField(required=False, min_value=1)
    status = serializers.ChoiceField(choices=Task.Status.choices, required=False)
    uon_record_kind = serializers.ChoiceField(choices=['request', 'lead'], required=False)
    uon_record_id = serializers.CharField(required=False, max_length=64)

    def validate(self, attrs):
        if ('uon_record_kind' in attrs) != ('uon_record_id' in attrs):
            raise serializers.ValidationError('Тип и ID записи U-ON передаются вместе.')
        return attrs
