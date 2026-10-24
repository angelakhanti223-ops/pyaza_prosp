from datetime import timedelta

from django.db import transaction
from django.db.models import F

from .models import KanbanColumn, Task, TaskPushReceipt


def task_is_closed(task):
    if task.status in [Task.Status.DONE, Task.Status.CANCELLED] or task.archived_at:
        return True
    columns = list(KanbanColumn.objects.order_by('order', 'pk').values_list('pk', flat=True))
    return len(columns) > 1 and task.column_id == columns[-1]


def sync_next_contact_task(lead_id, allow_create=False):
    """One contact task per lead, updated synchronously with the saved schedule."""
    from leads.models import Lead

    with transaction.atomic():
        lead = Lead.objects.select_for_update().get(pk=lead_id)
        key = f'next-contact:{lead.pk}'
        task = Task.all_objects.select_for_update().filter(automation_key=key).first()
        closed = lead.status in ['closed_won', 'closed_lost', 'failed', 'not_target']
        if not lead.next_contact_at or closed:
            if task and not task_is_closed(task):
                task.status = Task.Status.CANCELLED
                task.save(update_fields=['status', 'updated_at'])
                last = KanbanColumn.objects.order_by('-order', '-pk').first()
                if last:
                    reposition_task(task, last, next_order_in_column(last))
            return
        if task is None and not allow_create:
            return  # Unrelated sync must not backfill years of old next-contact dates.
        column = KanbanColumn.objects.order_by('order', 'pk').first()
        if column is None:
            column = KanbanColumn.objects.create(name='Новые', order=0)
        if task is None:
            task = Task(automation_key=key, origin=Task.Origin.NEXT_CONTACT, lead=lead, column=column, order=next_order_in_column(column))
        elif task_is_closed(task) and task.deadline == lead.next_contact_at and not allow_create:
            return
        rescheduled = task.deadline != lead.next_contact_at or task.archived_at is not None or task_is_closed(task)
        if task.pk and rescheduled:
            TaskPushReceipt.objects.filter(task=task).delete()
        task.title = f'Следующий контакт · {lead.name or "заявка"} · №{lead.pk}'[:255]
        task.description = f'Связаться с клиентом по заявке №{lead.pk}. Дата и ответственный синхронизируются с карточкой заявки.'
        task.assignee = lead.assigned_manager
        task.preferred_contact_channel = lead.preferred_messenger if lead.preferred_messenger in dict(Task.ContactChannel.choices) else ''
        task.deadline = lead.next_contact_at
        task.archived_at = None
        if rescheduled:
            task.status = Task.Status.NEW
        if rescheduled and task.column_id != column.pk:
            reposition_task(task, column, next_order_in_column(column))
        task.save()


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
