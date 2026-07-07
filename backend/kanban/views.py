from django.db.models import Q
from rest_framework import generics, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import is_head
from leads.models import Lead

from .models import KanbanColumn, Task
from .serializers import KanbanColumnSerializer, TaskMoveSerializer, TaskSerializer, TaskUpdateSerializer
from .services import next_order_in_column, reposition_task
from telegrambot.tasks import notify_task_assignment


class KanbanColumnListView(generics.ListAPIView):
    """Настраиваемые колонки доски (ТЗ 6) — управляются через Django admin."""

    queryset = KanbanColumn.objects.all()
    serializer_class = KanbanColumnSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None


class TaskViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Канбан-доска (ТЗ 6). Личная доска менеджера (свои задачи) + общая доска отдела
    для руководителя (тот же принцип ролевого доступа, что и в LeadViewSet)."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Task.objects.select_related('column', 'assignee', 'lead')
        if not is_head(self.request.user):
            qs = qs.filter(assignee=self.request.user)

        assignee_id = self.request.query_params.get('assignee')
        if assignee_id and is_head(self.request.user):
            qs = qs.filter(assignee_id=assignee_id)

        # Обращения (задачи, пришедшие из синхронизации напоминаний U-ON), привязанные
        # к нашему собственному Lead, актуальны на доске только пока связанная заявка
        # ещё новая/в работе — как только сделка продвинулась дальше, показывать их
        # незачем. Задачи-заявки (созданные вручную по Lead в нашей CRM) остаются
        # видимыми в любом статусе заявки. Задачи, подтянутые напрямую по обращениям/
        # заявкам из зеркала U-ON (integrations.tasks.sync_uon_request/sync_uon_lead)
        # не привязаны ни к какому Lead (lead=None) — для них статус-фильтр неприменим,
        # они должны быть видны всегда.
        qs = qs.exclude(
            Q(uon_reminder_id__isnull=False)
            & Q(lead__isnull=False)
            & ~Q(lead__status__in=[Lead.Status.NEW, Lead.Status.IN_PROGRESS]),
        )

        return qs

    def get_serializer_class(self):
        if self.action == 'partial_update':
            return TaskUpdateSerializer
        if self.action == 'move':
            return TaskMoveSerializer
        return TaskSerializer

    def perform_create(self, serializer):
        column = serializer.validated_data['column']
        task = serializer.save(order=next_order_in_column(column))
        if task.assignee_id:
            notify_task_assignment.delay(task.id)

    def partial_update(self, request, *args, **kwargs):
        task = self.get_object()
        old_assignee_id = task.assignee_id

        serializer = self.get_serializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        task = serializer.save()

        if task.assignee_id and task.assignee_id != old_assignee_id:
            notify_task_assignment.delay(task.id)

        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def move(self, request, pk=None):
        task = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reposition_task(task, serializer.validated_data['column'], serializer.validated_data['order'])
        task.refresh_from_db()
        return Response(TaskSerializer(task).data)
