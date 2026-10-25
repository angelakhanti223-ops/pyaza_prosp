from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import APIException

from .models import KanbanColumn, Task, TaskPushReceipt

CLOSED_STATUSES = [Task.Status.DONE, Task.Status.CANCELLED]


class TaskConflict(APIException):
    status_code = 409
    default_detail = 'Задача уже изменена. Обновите данные и повторите действие.'


def column_for_status(status):
    column, _ = KanbanColumn.objects.get_or_create(status=status, defaults={
        'name': Task.Status(status).label, 'order': list(Task.Status.values).index(status), 'is_active': True,
    })
    if not column.is_active:
        column.is_active = True
        column.save(update_fields=['is_active'])
    return column


def task_is_closed(task):
    return bool(task.archived_at or task.status in CLOSED_STATUSES)


def next_order_in_column(column):
    last = Task.objects.filter(column=column).order_by('-order').first()
    return last.order + 1 if last else 0


def _recreate_recurring_task(task):
    deadline = task.deadline + timedelta(days=1) if task.deadline else None
    if deadline and deadline <= timezone.now():
        deadline += timedelta(days=(timezone.localdate() - timezone.localtime(deadline).date()).days + 1)
    column = column_for_status(Task.Status.NEW)
    return Task.all_objects.get_or_create(recurrence_parent=task, defaults={
        'title': task.title, 'description': task.description, 'column': column, 'status': Task.Status.NEW,
        'assignee': task.assignee, 'lead': task.lead, 'deadline': deadline, 'is_recurring': True,
        'preferred_contact_channel': task.preferred_contact_channel,
        'uon_record_kind': task.uon_record_kind, 'uon_record_id': task.uon_record_id,
        'order': next_order_in_column(column),
    })[0]


def save_task(task, parent_save, *args, **kwargs):
    """All save paths share one status/column, postponement and completion lifecycle."""
    from leads.models import Lead

    with transaction.atomic():
        old_lead = Task.all_objects.filter(pk=task.pk).values_list('lead_id', flat=True).first() if task.pk else None
        lead_ids = sorted({value for value in [old_lead, task.lead_id] if value is not None})
        # Same lock order as contact scheduling: lead, then task.
        list(Lead.objects.select_for_update().filter(pk__in=lead_ids).order_by('pk'))
        old = Task.all_objects.select_for_update().filter(pk=task.pk).first() if task.pk else None
        expected = getattr(task, '_expected_updated_at', None)
        if old and expected is not None and old.updated_at != expected:
            raise TaskConflict()
        fields = kwargs.get('update_fields')
        writes = lambda name: fields is None or name in fields or f'{name}_id' in fields
        if old:
            for name in ['deadline', 'order', 'assignee_id', 'lead_id', 'is_recurring', 'archived_at']:
                base_name = name.removesuffix('_id')
                if not writes(base_name):
                    setattr(task, name, getattr(old, name))
        column_id = task.column_id if not old or writes('column') else old.column_id
        column = KanbanColumn.objects.filter(pk=column_id).first() if column_id else None
        status = task.status if not old or writes('status') else old.status
        if old:
            if status == old.status and column_id != old.column_id:
                if not column or not column.is_active or not column.status:
                    raise ValidationError('Колонка не связана с действующим статусом задачи.')
                status = column.status
        elif status == Task.Status.NEW and column and column.status:
            status = column.status
        if status not in Task.Status.values:
            raise ValidationError('Неизвестный статус задачи.')
        if task.origin == Task.Origin.NEXT_CONTACT and task.lead_id and not task.archived_at and status not in CLOSED_STATUSES:
            if Lead.objects.filter(pk=task.lead_id, status__in=['closed_won', 'closed_lost', 'failed', 'not_target']).exists():
                status = Task.Status.CANCELLED
        task.status = status
        task.column = column_for_status(status)
        if old and old.origin == Task.Origin.NEXT_CONTACT and task.lead_id != old.lead_id:
            raise ValidationError('Задача следующего контакта связана со своей заявкой.')
        if task.origin == Task.Origin.NEXT_CONTACT and task.is_recurring:
            raise ValidationError('Следующий контакт планируется датой в заявке, без ежедневных копий.')
        if task.purpose != Task.Purpose.GENERAL and task.is_recurring:
            raise ValidationError('Выдача документов и связь через полгода — разовые задачи.')
        if status == Task.Status.POSTPONED:
            if old and old.status != status and task.deadline == old.deadline:
                task.deadline = (old.deadline or timezone.now()) + timedelta(days=3)
            elif not old and task.deadline is None:
                task.deadline = timezone.now() + timedelta(days=3)
        if old and old.column_id != task.column_id and not getattr(task, '_position_managed', False):
            Task.objects.filter(column_id=old.column_id, order__gt=old.order).exclude(pk=task.pk).update(order=F('order') - 1)
            task.order = next_order_in_column(task.column)
        if fields is not None:
            kwargs['update_fields'] = set(fields) | {'status', 'column', 'order', 'deadline', 'closed_at', 'closure_reason', 'updated_at'}
        if status in CLOSED_STATUSES:
            if not old or old.status not in CLOSED_STATUSES:
                task.closed_at = timezone.now()
                task.closure_reason = 'deal_won' if getattr(task, '_closing_for_success', False) else 'manual'
        else:
            task.closed_at, task.closure_reason = None, ''
        result = parent_save(*args, **kwargs)
        task.__dict__.pop('_position_managed', None)
        if expected is not None:
            task._expected_updated_at = task.updated_at
        if old and (old.status in CLOSED_STATUSES or old.archived_at) and not task_is_closed(task):
            TaskPushReceipt.objects.filter(task=task).delete()
        if (old is None or old.status != Task.Status.DONE) and task.status == Task.Status.DONE and task.is_recurring and not task.archived_at and not getattr(task, '_closing_for_success', False):
            _recreate_recurring_task(task)
        return result


def sync_next_contact_task(lead_id, allow_create=False):
    from leads.models import Lead

    with transaction.atomic():
        lead = Lead.objects.select_for_update().get(pk=lead_id)
        key = f'next-contact:{lead.pk}'
        task = Task.all_objects.select_for_update().filter(automation_key=key).first()
        if not lead.next_contact_at or lead.status in ['closed_won', 'closed_lost', 'failed', 'not_target']:
            if task and not task_is_closed(task):
                task.status = Task.Status.CANCELLED
                task.save(update_fields=['status', 'updated_at'])
            return
        if task is None and not allow_create:
            return
        if task is None:
            column = column_for_status(Task.Status.NEW)
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
        task.save()


def reposition_task(task, target_column, target_order):
    if not target_column.is_active or not target_column.status:
        raise ValidationError('Колонка не связана со статусом задачи.')
    from leads.models import Lead

    with transaction.atomic():
        if task.lead_id:
            Lead.objects.select_for_update().get(pk=task.lead_id)
        current = Task.objects.select_for_update().get(pk=task.pk)
        expected = getattr(task, '_expected_updated_at', None)
        if expected is not None and current.updated_at != expected:
            raise TaskConflict()
        old_column_id = current.column_id
        target_order = min(max(0, target_order), Task.objects.filter(column=target_column).exclude(pk=task.pk).count())
        current.column, current.order = target_column, target_order
        current._position_managed = True
        current.save(update_fields=['column', 'order'])
        # Rebuild dense positions from actual rows, including any new recurring child.
        # This also repairs historic gaps after archival/deletion and preserves hidden rows.
        for column_id in {old_column_id, current.column_id}:
            rows = list(Task.objects.filter(column_id=column_id).exclude(pk=current.pk).order_by('order', 'pk'))
            if column_id == current.column_id:
                rows.insert(min(target_order, len(rows)), current)
            for index, row in enumerate(rows):
                row.order = index
            Task.objects.bulk_update(rows, ['order'])
        current.refresh_from_db()
        task.__dict__.update(current.__dict__)
