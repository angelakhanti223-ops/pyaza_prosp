from django.db import transaction
from django.db.models import F

from .models import KanbanColumn, Task


def next_order_in_column(column: KanbanColumn) -> int:
    """Order value that appends a new task to the end of `column`."""
    last = Task.objects.filter(column=column).order_by('-order').first()
    return (last.order + 1) if last else 0


def reposition_task(task: Task, target_column: KanbanColumn, target_order: int):
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
