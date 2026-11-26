"""Read-only trip agenda and the same open tasks used by the CRM board."""
from collections import defaultdict
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.serializers import UserSerializer
from integrations.models import UonLeadRecord, UonRequestRecord
from leads.models import Lead
from .models import Task
from .serializers import TaskSerializer
from .services import CLOSED_STATUSES

MOSCOW = ZoneInfo('Europe/Moscow')
TRAVEL_STATUSES = [Lead.Status.BOOKED, Lead.Status.PREPAID, Lead.Status.WAITING_PAYMENT,
                   Lead.Status.PAID, Lead.Status.DEPARTURE, Lead.Status.CHECK_IN,
                   Lead.Status.RETURNED, Lead.Status.CLOSED_WON]
EXCLUDED_UON_STATUSES = {'неуспешная', 'закрыта (отказ)', 'провалена', 'нецелевой',
                         'отменена', 'отменен', 'аннулирована', 'отмена',
                         'closed_lost', 'failed', 'not_target', 'cancelled'}


class OperationsParams(serializers.Serializer):
    start = serializers.DateField(required=False)
    days = serializers.ChoiceField(choices=[1, 7, 30], default=7)
    assignee = serializers.IntegerField(min_value=1, required=False)


def trip_dates(lead, record):
    departure = lead.departure_date if lead else None
    departure_source = 'crm' if departure else None
    if departure is None and record:
        departure = record.date_begin
        departure_source = 'uon' if departure else None
    returned = lead.return_date if lead else None
    return_source = 'crm' if returned else None
    if returned is None and record and record.date_end:
        returned, return_source = record.date_end, 'uon_tour_end'
    if returned is None and lead and departure and lead.nights is not None:
        try:
            returned, return_source = departure + timedelta(days=lead.nights), 'estimated_nights'
        except OverflowError:
            pass
    return departure, returned, departure_source, return_source


class OperationsDashboardView(APIView):
    # Same visibility as the existing board: all authenticated employees.
    permission_classes = [IsAuthenticated]

    def get(self, request):
        params = OperationsParams(data=request.query_params)
        params.is_valid(raise_exception=True)
        values = params.validated_data
        now = timezone.now()
        today = timezone.localdate(now, MOSCOW)
        start = values.get('start', today)
        days = int(values['days'])
        try:
            end = start + timedelta(days=days - 1)
        except OverflowError:
            raise serializers.ValidationError({'start': 'Дата выходит за допустимый период.'})
        assignee = values.get('assignee')

        tasks = list(Task.objects.exclude(status__in=CLOSED_STATUSES)
                     .select_related('column', 'assignee', 'lead')
                     .prefetch_related('attachments__uploaded_by').order_by('pk'))
        if assignee:
            tasks = [t for t in tasks if t.assignee_id == assignee]
        tasks.sort(key=lambda t: (t.deadline is None, t.deadline or now, t.pk))
        by_lead, by_request, by_ticket = defaultdict(set), defaultdict(set), defaultdict(set)
        for task in tasks:
            if task.lead_id:
                by_lead[task.lead_id].add(task.pk)
            if task.uon_record_kind == 'request':
                by_request[task.uon_record_id].add(task.pk)
            elif task.uon_record_kind == 'lead':
                by_ticket[task.uon_record_id].add(task.pk)

        users = list(get_user_model().objects.filter(is_active=True).order_by('first_name', 'username'))
        # A U-ON name is resolved only when it uniquely identifies an active user.
        user_names = defaultdict(set)
        for user in users:
            for label in {user.username, user.get_full_name()}:
                if label.strip():
                    user_names[label.strip().casefold()].add(user.pk)
        records = {r.uon_id: r for r in UonRequestRecord.objects.filter(is_archive=False)}
        leads = list(Lead.objects.select_related('direction', 'assigned_manager').order_by('pk'))
        linked_ids = {lead.uon_request_id for lead in leads if lead.uon_request_id}
        groups = {}
        for lead in leads:
            if lead.status not in TRAVEL_STATUSES:
                continue
            key = f'uon:{lead.uon_request_id}' if lead.uon_request_id else f'lead:{lead.pk}'
            groups.setdefault(key, []).append(lead)

        trips = []
        for key, group in groups.items():
            # One booking = one event, even when more than one local lead is linked.
            candidates = [lead for lead in group if not assignee or lead.assigned_manager_id == assignee]
            if not candidates:
                continue
            lead = candidates[0]
            record = records.get(lead.uon_request_id)
            task_ids = set(by_request[lead.uon_request_id]) if lead.uon_request_id else set()
            for linked in group:
                task_ids.update(by_lead[linked.pk])
                if linked.uon_ticket_id:
                    task_ids.update(by_ticket[linked.uon_ticket_id])
            manager = lead.assigned_manager
            trips.append(self.trip(key, lead, record, sorted(task_ids),
                                   manager.pk if manager else None,
                                   (manager.get_full_name() or manager.username) if manager else 'Не назначен'))
        for uid, record in records.items():
            if uid in linked_ids or record.status_name.strip().casefold() in EXCLUDED_UON_STATUSES:
                continue
            matches = user_names.get(record.manager_name.strip().casefold(), set())
            manager_id = next(iter(matches)) if len(matches) == 1 else None
            if assignee and manager_id != assignee:
                continue
            trips.append(self.trip(f'uon:{uid}', None, record, sorted(by_request[uid]),
                                   manager_id, record.manager_name or 'Не назначен'))

        departures, returns, missing = [], [], []
        for trip in trips:
            departure, returned = trip['departure_date'], trip['return_date']
            invalid = departure and returned and returned < departure
            if departure and start <= departure <= end:
                departures.append(trip)
            if returned and not invalid and start <= returned <= end:
                returns.append(trip)
            # Historical, fully elapsed trips do not clutter the data-quality queue.
            relevant = not departure or departure >= start or (start - departure).days <= 30 or (returned and returned >= start)
            if relevant and (not departure or not returned or invalid):
                missing.append({**trip, 'issue': 'Возвращение раньше вылета' if invalid else
                                'Не указана дата вылета' if not departure else 'Не указана дата возвращения'})
        departures.sort(key=lambda t: (t['departure_date'], t['name'], t['key']))
        returns.sort(key=lambda t: (t['return_date'], t['name'], t['key']))

        request_ids = {t.uon_record_id for t in tasks if t.uon_record_kind == 'request'}
        ticket_ids = {t.uon_record_id for t in tasks if t.uon_record_kind == 'lead'}
        context = {'request': request,
                   'uon_request_status': {uid: r.status_name for uid, r in records.items()},
                   'uon_lead_status': dict(UonLeadRecord.objects.filter(uon_id__in=ticket_ids)
                                           .values_list('uon_id', 'status_name'))}
        # Include archived request labels for tasks without reactivating their trips.
        context['uon_request_status'].update(dict(UonRequestRecord.objects.filter(uon_id__in=request_ids)
                                                  .values_list('uon_id', 'status_name')))
        buckets = {'overdue': [], 'today': [], 'period': [], 'no_deadline': [], 'all': [t.pk for t in tasks]}
        for task in tasks:
            if task.deadline is None:
                buckets['no_deadline'].append(task.pk)
                continue
            day = timezone.localdate(task.deadline, MOSCOW)
            if task.deadline < now:
                buckets['overdue'].append(task.pk)
            if day == today:
                buckets['today'].append(task.pk)
            if start <= day <= end:
                buckets['period'].append(task.pk)
        response = Response({
            'generated_at': now, 'today': today,
            'period': {'start': start, 'end': end, 'days': days, 'timezone': 'Europe/Moscow'},
            'departures': departures, 'returns': returns, 'missing_dates': missing,
            'tasks': TaskSerializer(tasks, many=True, context=context).data, 'task_buckets': buckets,
            'counts': {'departures': len(departures), 'returns': len(returns),
                       'documents': sum(t.purpose == Task.Purpose.DOCUMENTS for t in tasks),
                       'missing_dates': len(missing), **{k: len(v) for k, v in buckets.items()}},
            'managers': UserSerializer(users, many=True).data,
        })
        response['Cache-Control'] = 'private, no-store'
        return response

    @staticmethod
    def trip(key, lead, record, task_ids, manager_id, manager_name):
        departure, returned, departure_source, return_source = trip_dates(lead, record)
        uid = record.uon_id if record else lead.uon_request_id if lead else ''
        return {
            'key': key, 'lead_id': lead.pk if lead else None, 'uon_id': uid or None,
            'name': lead.name if lead else record.client_name or f'Заявка U-ON №{uid}',
            'phone': lead.phone if lead else record.client_phone,
            'direction': lead.direction.name if lead and lead.direction else '',
            'departure_city': lead.departure_city if lead else '',
            'departure_date': departure, 'return_date': returned,
            'departure_source': departure_source, 'return_source': return_source,
            'manager_id': manager_id, 'manager_name': manager_name,
            'status': lead.get_status_display() if lead else record.status_name,
            'task_ids': task_ids,
            'href': f'/crm/leads/{lead.pk}' if lead else f'/crm/uon-requests?uon_id={uid}',
        }
