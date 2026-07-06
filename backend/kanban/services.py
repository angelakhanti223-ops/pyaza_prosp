from datetime import timedelta

from django.db import transaction
from django.db.models import F

from .models import KanbanColumn, Task


def next_order_in_column(column: KanbanColumn) -> int:
    """Order value that appends a new task to the end of `column`."""
    last = Task.objects.filter(column=column).order_by('-order').first()
    return (last.order + 1) if last else 0


def _recreate_recurring_task(task: Task) -> None:
    """Spawns tomorrow's copy of a daily task once its current instance reaches
    the last column — keeps the same title/assignee/lead, shifts the deadline by a day."""
    first_column = KanbanColumn.objects.order_by('order').first()
    if first_column is None:
        return
    Task.objects.create(
        title=task.title,
        description=task.description,
        column=first_column,
        assignee=task.assignee,
        lead=task.lead,
        deadline=(task.deadline + timedelta(days=1)) if task.deadline else None,
        is_recurring=True,
        order=next_order_in_column(first_column),
    )


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

        last_column = KanbanColumn.objects.order_by('-order').first()
        if (
            task.is_recurring
            and last_column is not None
            and target_column.id == last_column.id
            and old_column_id != last_column.id
        ):
            _recreate_recurring_task(task)
