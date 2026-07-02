from django.db import transaction
from django.db.models import F
from rest_framework import generics, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import is_head

from .models import KanbanColumn, Task
from .serializers import KanbanColumnSerializer, TaskMoveSerializer, TaskSerializer, TaskUpdateSerializer


class KanbanColumnListView(generics.ListAPIView):
    """Настраиваемые колонки доски (ТЗ 6) — управляются через Django admin."""

    queryset = KanbanColumn.objects.all()
    serializer_class = KanbanColumnSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None


def _reposition_task(task: Task, target_column: KanbanColumn, target_order: int):
    """Shifts sibling `order` values so the task lands at `target_order` in `target_column`,
    matching the drag-and-drop position from the board (ТЗ 6)."""
    with transaction.atomic():
        old_column_id = task.column_id
        old_order = task.order

        if old_column_id == target_column.id:
            if target_order > old_order:
                Task.objects.filter(
                    column_id=old_column_id, order__gt=old_order, order__lte=target_order,
                ).exclude(pk=task.pk).update(order=F('order') - 1)
            elif target_order < old_order:
                Task.objects.filter(
                    column_id=old_column_id, order__gte=target_order, order__lt=old_order,
                ).exclude(pk=task.pk).update(order=F('order') + 1)
        else:
            Task.objects.filter(column_id=old_column_id, order__gt=old_order).update(order=F('order') - 1)
            Task.objects.filter(column_id=target_column.id, order__gte=target_order).update(order=F('order') + 1)

        task.column = target_column
        task.order = target_order
        task.save(update_fields=['column', 'order'])


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

        return qs

    def get_serializer_class(self):
        if self.action == 'partial_update':
            return TaskUpdateSerializer
        if self.action == 'move':
            return TaskMoveSerializer
        return TaskSerializer

    def perform_create(self, serializer):
        column = serializer.validated_data['column']
        last = Task.objects.filter(column=column).order_by('-order').first()
        serializer.save(order=(last.order + 1) if last else 0)

    def partial_update(self, request, *args, **kwargs):
        task = self.get_object()
        serializer = self.get_serializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def move(self, request, pk=None):
        task = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _reposition_task(task, serializer.validated_data['column'], serializer.validated_data['order'])
        task.refresh_from_db()
        return Response(TaskSerializer(task).data)
