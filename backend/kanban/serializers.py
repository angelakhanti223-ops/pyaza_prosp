from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from accounts.serializers import UserSerializer
from integrations.models import UonLeadRecord, UonRequestRecord

from .models import KanbanColumn, Task

User = get_user_model()


class KanbanColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = KanbanColumn
        fields = ['id', 'name', 'order']


class TaskSerializer(serializers.ModelSerializer):
    assignee = UserSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        source='assignee', queryset=User.objects.all(), write_only=True, required=False, allow_null=True,
    )
    lead_name = serializers.CharField(source='lead.name', read_only=True, default=None)
    lead_status_display = serializers.CharField(source='lead.get_status_display', read_only=True, default=None)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    uon_status_name = serializers.SerializerMethodField()
    kind = serializers.ReadOnlyField()
    priority = serializers.ReadOnlyField()

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'status_display', 'column', 'assignee', 'assignee_id',
            'lead', 'lead_name', 'lead_status_display', 'deadline', 'is_recurring', 'kind', 'priority',
            'uon_record_kind', 'uon_record_id', 'uon_status_name', 'order', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'status_display', 'order', 'created_at', 'updated_at', 'kind', 'priority',
            'uon_record_kind', 'uon_record_id',
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


class TaskUpdateSerializer(serializers.ModelSerializer):
    """PATCH: edit task fields, but never column/order directly — use the move action instead."""

    assignee_id = serializers.PrimaryKeyRelatedField(
        source='assignee', queryset=User.objects.all(), write_only=True, required=False, allow_null=True,
    )

    class Meta:
        model = Task
        fields = ['title', 'description', 'status', 'assignee_id', 'lead', 'deadline', 'is_recurring']

    def update(self, instance, validated_data):
        # Переход именно В «Отложено» (не повторное сохранение уже отложенной задачи)
        # отодвигает дедлайн на +3 дня от текущего срока — решение заказчика, 01.09.2026.
        # Сравниваем с ТЕКУЩИМ значением, а не просто с наличием ключа в payload: форма
        # редактирования в CRM всегда шлёт deadline (это обычное controlled-поле, не
        # опускается, если пользователь его не трогал) — проверка "ключа нет" никогда
        # бы не срабатывала оттуда. Если пользователь реально выбрал НОВУЮ дату — она
        # будет отличаться от instance.deadline, и мы её не перезапишем.
        new_status = validated_data.get('status')
        if new_status == Task.Status.POSTPONED and instance.status != Task.Status.POSTPONED:
            submitted_deadline = validated_data.get('deadline', instance.deadline)
            if submitted_deadline == instance.deadline:
                base = instance.deadline or timezone.now()
                validated_data['deadline'] = base + timedelta(days=3)
        return super().update(instance, validated_data)


class TaskMoveSerializer(serializers.Serializer):
    column = serializers.PrimaryKeyRelatedField(queryset=KanbanColumn.objects.all())
    order = serializers.IntegerField(min_value=0)
