from calendar import monthrange
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import is_head
from kanban.models import Task

from .dashboard import _revenue_recognized_qs
from .models import Lead

CLOSED_STATUSES = [
    Lead.Status.CLOSED_WON,
    Lead.Status.CLOSED_LOST,
    Lead.Status.FAILED,
    Lead.Status.NOT_TARGET,
]

WORK_STATUSES = [
    Lead.Status.NEW,
    Lead.Status.FOLLOW_UP,
    Lead.Status.IN_PROGRESS,
    Lead.Status.SELECTION,
    Lead.Status.OPTIONS_PROPOSED,
    Lead.Status.BOOKED,
    Lead.Status.PREPAID,
    Lead.Status.WAITING_PAYMENT,
]

MONEY_STATUSES = [Lead.Status.PREPAID, Lead.Status.PAID, Lead.Status.CLOSED_WON]
TASK_DONE_STATUSES = [Task.Status.DONE, Task.Status.CANCELLED]


def _dt(year, month, day, h=0, m=0, s=0, us=0):
    return timezone.make_aware(datetime(year, month, day, h, m, s, us))


def period_bounds(period):
    """Calendar reporting periods for management dashboard."""
    today = timezone.localdate()

    if period == 'current_week':
        monday = today - timedelta(days=today.weekday())
        sunday = monday + timedelta(days=6)
        return (
            _dt(monday.year, monday.month, monday.day),
            _dt(sunday.year, sunday.month, sunday.day, 23, 59, 59, 999999),
            'Текущая неделя',
        )

    if period == 'last_month':
        year, month = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
        last_day = monthrange(year, month)[1]
        return (
            _dt(year, month, 1),
            _dt(year, month, last_day, 23, 59, 59, 999999),
            'Прошлый месяц',
        )

    if period == 'current_year':
        return (
            _dt(today.year, 1, 1),
            _dt(today.year, 12, 31, 23, 59, 59, 999999),
            'Текущий год',
        )

    year, month = today.year, today.month
    last_day = monthrange(year, month)[1]
    return (
        _dt(year, month, 1),
        _dt(year, month, last_day, 23, 59, 59, 999999),
        'Текущий месяц',
    )


def money(value):
    return float(value or Decimal('0'))


def user_name(user):
    if not user:
        return 'Не назначен'
    return (f'{user.first_name} {user.last_name}'.strip() or user.username)


def can_view_management(user):
    username = (getattr(user, 'username', '') or '').lower()
    full_name = user_name(user).lower()
    return bool(is_head(user) or username in {'admin', 'elena'} or 'елена' in full_name)


def count_qs(qs):
    return qs.count()


def amount_sum(qs, field):
    return money(qs.aggregate(total=Sum(field))['total'])


class ManagementDashboardView(APIView):
    """Operational/management dashboard for owner/admin.

    Unlike the ordinary CRM dashboard, this endpoint returns a period-aware
    management view: week/month/last month/year. Money is counted by the same
    recognized-revenue logic as plan/fact: first transition into prepaid/paid/
    successful status within the selected period.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_view_management(request.user):
            return Response({'detail': 'Недостаточно прав'}, status=403)

        period_code = request.query_params.get('period') or 'current_month'
        date_from, date_to, period_label = period_bounds(period_code)

        all_leads = Lead.objects.select_related('assigned_manager', 'direction')
        period_leads = all_leads.filter(created_at__gte=date_from, created_at__lte=date_to)
        revenue_leads = _revenue_recognized_qs(all_leads, date_from, date_to).select_related('assigned_manager')

        now = timezone.now()
        today_start = timezone.make_aware(datetime.combine(timezone.localdate(), datetime.min.time()))
        today_end = timezone.make_aware(datetime.combine(timezone.localdate(), datetime.max.time()))
        seven_days_end = today_end + timedelta(days=7)

        active_leads = all_leads.exclude(status__in=CLOSED_STATUSES)
        workable_leads = all_leads.filter(status__in=WORK_STATUSES)
        active_period_leads = period_leads.exclude(status__in=CLOSED_STATUSES)

        tasks = Task.objects.exclude(status__in=TASK_DONE_STATUSES)
        tasks_today = tasks.filter(deadline__gte=today_start, deadline__lte=today_end)
        tasks_overdue = tasks.filter(deadline__lt=now)

        contacts_today = workable_leads.filter(next_contact_at__gte=today_start, next_contact_at__lte=today_end)
        contacts_overdue = workable_leads.filter(next_contact_at__lt=now)
        no_next_contact = workable_leads.filter(
            next_contact_at__isnull=True,
            status__in=[Lead.Status.FOLLOW_UP, Lead.Status.IN_PROGRESS, Lead.Status.SELECTION, Lead.Status.OPTIONS_PROPOSED],
        )

        payments_soon = active_leads.filter(full_payment_due_at__gte=today_start, full_payment_due_at__lte=seven_days_end)
        payments_overdue = active_leads.filter(full_payment_due_at__lt=now)
        departures_soon = active_leads.filter(departure_date__gte=timezone.localdate(), departure_date__lte=timezone.localdate() + timedelta(days=7))
        docs_to_issue = departures_soon.filter(status__in=[Lead.Status.PAID, Lead.Status.DEPARTURE, Lead.Status.CHECK_IN, Lead.Status.WAITING_PAYMENT])

        money_totals = revenue_leads.aggregate(
            commission=Sum('commission'),
            deal_amount=Sum('deal_amount'),
            deals=Count('id'),
        )

        manager_map = {}
        for lead in all_leads:
            key = str(lead.assigned_manager_id or 'no-manager')
            row = manager_map.setdefault(key, {
                'manager_id': lead.assigned_manager_id,
                'manager_name': user_name(lead.assigned_manager),
                'active': 0,
                'new_leads': 0,
                'overdue_contacts': 0,
                'overdue_payments': 0,
                'sold': 0,
                'commission': 0.0,
                'lost': 0,
                'failed': 0,
            })
            if lead.status not in CLOSED_STATUSES:
                row['active'] += 1
            if lead.next_contact_at and lead.next_contact_at < now and lead.status in WORK_STATUSES:
                row['overdue_contacts'] += 1
            if lead.full_payment_due_at and lead.full_payment_due_at < now and lead.status not in CLOSED_STATUSES:
                row['overdue_payments'] += 1

        for lead in period_leads:
            key = str(lead.assigned_manager_id or 'no-manager')
            row = manager_map.setdefault(key, {
                'manager_id': lead.assigned_manager_id,
                'manager_name': user_name(lead.assigned_manager),
                'active': 0,
                'new_leads': 0,
                'overdue_contacts': 0,
                'overdue_payments': 0,
                'sold': 0,
                'commission': 0.0,
                'lost': 0,
                'failed': 0,
            })
            if lead.status == Lead.Status.NEW:
                row['new_leads'] += 1
            if lead.status == Lead.Status.CLOSED_LOST:
                row['lost'] += 1
            if lead.status == Lead.Status.FAILED:
                row['failed'] += 1

        for lead in revenue_leads:
            key = str(lead.assigned_manager_id or 'no-manager')
            row = manager_map.setdefault(key, {
                'manager_id': lead.assigned_manager_id,
                'manager_name': user_name(lead.assigned_manager),
                'active': 0,
                'new_leads': 0,
                'overdue_contacts': 0,
                'overdue_payments': 0,
                'sold': 0,
                'commission': 0.0,
                'lost': 0,
                'failed': 0,
            })
            row['sold'] += 1
            row['commission'] += money(lead.commission)

        status_counts = {row['status']: row['count'] for row in period_leads.values('status').annotate(count=Count('id'))}
        status_rows = [
            {'status': status, 'status_display': label, 'count': status_counts.get(status, 0)}
            for status, label in Lead.Status.choices
            if status_counts.get(status, 0) > 0
        ]

        source_created = {row['source']: row['count'] for row in period_leads.values('source').annotate(count=Count('id'))}
        source_sales = {}
        for row in revenue_leads.values('source').annotate(count=Count('id'), commission=Sum('commission')):
            source_sales[row['source']] = {'sold': row['count'], 'commission': money(row['commission'])}
        source_rows = []
        for source, count in source_created.items():
            sales = source_sales.get(source, {'sold': 0, 'commission': 0.0})
            source_rows.append({
                'source': source,
                'source_display': Lead.Source(source).label if source else 'Не указан',
                'count': count,
                'sold': sales['sold'],
                'commission': sales['commission'],
            })
        source_rows.sort(key=lambda row: (row['commission'], row['count']), reverse=True)

        reason_rows = []
        for row in (
            period_leads.filter(status__in=[Lead.Status.CLOSED_LOST, Lead.Status.FAILED, Lead.Status.NOT_TARGET])
            .values('failure_reason')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        ):
            reason_rows.append({'reason': row['failure_reason'] or 'Причина не указана', 'count': row['count']})

        return Response({
            'period': {
                'code': period_code,
                'label': period_label,
                'from': date_from.isoformat(),
                'to': date_to.isoformat(),
            },
            'operational': {
                'tasks_today': count_qs(tasks_today),
                'tasks_overdue': count_qs(tasks_overdue),
                'contacts_today': count_qs(contacts_today),
                'contacts_overdue': count_qs(contacts_overdue),
                'no_next_contact': count_qs(no_next_contact),
                'payments_soon_count': count_qs(payments_soon),
                'payments_soon_amount': amount_sum(payments_soon, 'balance_due'),
                'payments_overdue_count': count_qs(payments_overdue),
                'payments_overdue_amount': amount_sum(payments_overdue, 'balance_due'),
                'departures_soon': count_qs(departures_soon),
                'docs_to_issue': count_qs(docs_to_issue),
                'active_potential_commission': amount_sum(active_leads, 'commission'),
                'active_balance': amount_sum(active_leads, 'balance_due'),
                'no_manager': active_leads.filter(assigned_manager__isnull=True).count(),
            },
            'money': {
                'commission_total': money(money_totals['commission']),
                'deal_amount_total': money(money_totals['deal_amount']),
                'deals_count': money_totals['deals'],
                'active_period_count': active_period_leads.count(),
            },
            'manager_rows': sorted(manager_map.values(), key=lambda row: (row['commission'], row['active']), reverse=True),
            'status_rows': status_rows,
            'source_rows': source_rows[:10],
            'reason_rows': reason_rows,
        })
