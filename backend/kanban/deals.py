"""Task rules for a successful local deal or an observed U-ON request transition."""
from calendar import monthrange
from datetime import datetime, time, timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import Task
from .services import CLOSED_STATUSES, column_for_status, next_order_in_column

WON_LABELS = {'успешная', 'закрыта (успех)', 'closed_won'}
KEPT_PURPOSES = [Task.Purpose.DOCUMENTS, Task.Purpose.FOLLOW_UP_6M]


def is_successful_uon_status(label):
    # Exact names only: «Неуспешная», archives and unknown custom stages are not success.
    return (label or '').strip().casefold() in WON_LABELS


def successful_request_ids():
    from integrations.models import UonRequestRecord
    return [uid for uid, label in UonRequestRecord.objects.values_list('uon_id', 'status_name') if is_successful_uon_status(label)]


def related_deal_tasks(lead=None, request=None):
    from leads.models import Lead

    request_id = request.uon_id if request else (lead.uon_request_id if lead else '')
    leads = Lead.objects.filter(uon_request_id=request_id) if request_id else Lead.objects.filter(pk=lead.pk) if lead else Lead.objects.none()
    scope = Q(lead_id__in=leads.values('pk'))
    tickets = list(leads.exclude(uon_ticket_id='').values_list('uon_ticket_id', flat=True))
    if tickets:
        scope |= Q(uon_record_kind='lead', uon_record_id__in=tickets)
    if request_id:
        scope |= Q(uon_record_kind='request', uon_record_id=request_id)
    return scope, leads


def after_six_months(day):
    index = day.year * 12 + day.month - 1 + 6
    year, month = divmod(index, 12)
    month += 1
    return day.replace(year=year, month=month, day=min(day.day, monthrange(year, month)[1]))


def _ensure_follow_up(scope, lead, request):
    request_id = request.uon_id if request else (lead.uon_request_id if lead else '')
    key = f'post-sale:request:{request_id}:followup-6m' if request_id else f'post-sale:lead:{lead.pk}:followup-6m'
    existing = Task.all_objects.filter(automation_key=key).first()
    if existing:
        return existing
    # Adopt an existing contact, including a completed one; don't create a second reminder.
    existing = Task.all_objects.filter(scope, purpose=Task.Purpose.FOLLOW_UP_6M).order_by('pk').first()
    if existing:
        if not existing.automation_key:
            existing.automation_key = key
            existing.origin = Task.Origin.AFTER_SALE
            existing.save(update_fields=['automation_key', 'origin'])
        return existing
    reference = request.date_end if request and request.date_end else None
    if reference is None and lead and lead.departure_date and lead.nights:
        reference = lead.departure_date + timedelta(days=lead.nights)
    reference = reference or timezone.localdate()
    deadline = timezone.make_aware(datetime.combine(after_six_months(reference), time(10)))
    assignee = lead.assigned_manager if lead else None
    if not assignee and request:
        from integrations.tasks import _match_manager_user
        assignee = _match_manager_user(request.manager_name)
    column = column_for_status(Task.Status.POSTPONED)
    return Task.all_objects.get_or_create(automation_key=key, defaults={
        'title': f'Связаться через полгода · {(lead.name if lead else request.client_name) or "клиент"}'[:255],
        'description': f'Уточнить планы на следующий отпуск. Срок: 6 календарных месяцев от {reference:%d.%m.%Y}, 10:00 МСК. При отсутствии даты возвращения используется дата успешного закрытия.',
        'origin': Task.Origin.AFTER_SALE, 'purpose': Task.Purpose.FOLLOW_UP_6M,
        'lead': lead, 'uon_record_kind': 'request' if request_id else '', 'uon_record_id': request_id,
        'assignee': assignee, 'deadline': deadline, 'column': column, 'status': Task.Status.POSTPONED,
        'order': next_order_in_column(column),
        'preferred_contact_channel': lead.preferred_messenger if lead and lead.preferred_messenger in Task.ContactChannel.values else '',
    })[0]


def close_successful_deal(lead=None, request=None, create_follow_up=True):
    from integrations.models import UonRequestRecord

    with transaction.atomic():
        scope, leads = related_deal_tasks(lead, request)
        locked = list(leads.select_for_update().order_by('pk'))
        if lead is not None:
            lead = next((item for item in locked if item.pk == lead.pk), lead)
        elif locked:
            lead = locked[0]
        if request is None and lead and lead.uon_request_id:
            request = UonRequestRecord.objects.filter(uon_id=lead.uon_request_id).first()
        count = 0
        tasks = Task.objects.select_for_update().filter(scope).exclude(status__in=CLOSED_STATUSES).exclude(purpose__in=KEPT_PURPOSES).order_by('pk')
        for task in tasks:
            task.status = Task.Status.DONE
            task._closing_for_success = True
            task.save(update_fields=['status'])
            count += 1
        if create_follow_up:
            _ensure_follow_up(scope, lead, request)
        return count
