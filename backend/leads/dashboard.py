from calendar import monthrange
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import is_head

from .models import Lead, LeadStatusHistory, MonthlyPlan

PERIOD_DAYS = {'7d': 7, '30d': 30, '90d': 90}

# Порядок этапов воронки для конверсии (ТЗ 7). Закрытые "в отказ" заявки не
# входят в положительную воронку — это отдельный, негативный, исход.
FUNNEL_STAGES = [
    Lead.Status.NEW,
    Lead.Status.IN_PROGRESS,
    Lead.Status.OPTIONS_PROPOSED,
    Lead.Status.BOOKED,
    Lead.Status.PAID,
    Lead.Status.CLOSED_WON,
]


def _compute(base_qs, date_from, date_to):
    period_leads = base_qs.filter(created_at__gte=date_from, created_at__lte=date_to)
    total = period_leads.count()

    status_counts = {row['status']: row['count'] for row in period_leads.values('status').annotate(count=Count('id'))}
    leads_by_status = [
        {'status': status, 'status_display': label, 'count': status_counts.get(status, 0)}
        for status, label in Lead.Status.choices
    ]

    period_ids = list(period_leads.values_list('id', flat=True))
    conversion = []
    for stage in FUNNEL_STAGES:
        reached = (
            Lead.objects.filter(id__in=period_ids)
            .filter(Q(status=stage) | Q(status_history__new_status=stage))
            .distinct()
            .count()
        )
        conversion.append({
            'status': stage,
            'status_display': Lead.Status(stage).label,
            'count': reached,
            'percent': round(reached / total * 100, 1) if total else 0,
        })

    # «Закрыта (успех)» — реальный момент получения денег в этой команде;
    # «Оплачено» в рабочем процессе почти не используется как отдельный шаг
    # (решение заказчика, 26.08.2026).
    won_leads = period_leads.filter(status=Lead.Status.CLOSED_WON)
    totals = won_leads.aggregate(commission=Sum('commission'), deal_amount=Sum('deal_amount'))

    daily = (
        period_leads.annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )

    return {
        'new_leads_count': total,
        'leads_by_status': leads_by_status,
        'conversion': conversion,
        'commission_total': totals['commission'] or 0,
        'deal_amount_total': totals['deal_amount'] or 0,
        'daily_dynamics': [{'date': row['day'].isoformat(), 'count': row['count']} for row in daily],
    }


class DashboardView(APIView):
    """Сводная панель (ТЗ 7): личная — для менеджера, по отделу — для руководителя."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        days = PERIOD_DAYS.get(request.query_params.get('period'), 30)
        date_to = timezone.now()
        date_from = date_to - timedelta(days=days)

        head = is_head(request.user)
        manager_filter = request.query_params.get('manager')

        base_qs = Lead.objects.all()
        if not head:
            base_qs = base_qs.filter(assigned_manager=request.user)
        elif manager_filter:
            base_qs = base_qs.filter(assigned_manager_id=manager_filter)

        data = _compute(base_qs, date_from, date_to)
        data['period'] = {'from': date_from.isoformat(), 'to': date_to.isoformat()}
        data['scope'] = 'department' if (head and not manager_filter) else 'personal'

        if head and not manager_filter:
            by_manager = (
                Lead.objects.filter(
                    created_at__gte=date_from, created_at__lte=date_to,
                    status=Lead.Status.CLOSED_WON, assigned_manager__isnull=False,
                )
                .values('assigned_manager_id', 'assigned_manager__first_name', 'assigned_manager__last_name', 'assigned_manager__username')
                .annotate(commission=Sum('commission'), deals=Count('id'))
                .order_by('-commission')
            )
            data['commission_by_manager'] = [
                {
                    'manager_id': row['assigned_manager_id'],
                    'manager_name': (
                        f"{row['assigned_manager__first_name']} {row['assigned_manager__last_name']}".strip()
                        or row['assigned_manager__username']
                    ),
                    'commission': row['commission'] or 0,
                    'deals': row['deals'],
                }
                for row in by_manager
            ]

        return Response(data)


def month_bounds(year, month):
    """Границы календарного месяца в текущей таймзоне проекта (Europe/Moscow)."""
    start = timezone.make_aware(datetime(year, month, 1))
    last_day = monthrange(year, month)[1]
    end = timezone.make_aware(datetime(year, month, last_day, 23, 59, 59, 999999))
    return start, end


def actual_commission_for_month(manager, year, month):
    """Комиссия менеджера, засчитанная в план месяца — по дате перехода заявки в
    статус «Закрыта (успех)» (LeadStatusHistory), а не по дате создания заявки.
    Это реальный момент получения денег в этой команде — «Оплачено» как
    отдельный шаг почти не используется (решение заказчика, 26.08.2026)."""
    start, end = month_bounds(year, month)
    lead_ids = (
        LeadStatusHistory.objects.filter(
            new_status=Lead.Status.CLOSED_WON, changed_at__gte=start, changed_at__lte=end,
            lead__assigned_manager=manager,
        )
        .values_list('lead_id', flat=True)
        .distinct()
    )
    return Lead.objects.filter(id__in=lead_ids).aggregate(total=Sum('commission'))['total'] or 0


def plan_progress_rows(year, month, managers=None):
    """Строки план/факт по комиссии за месяц + зарплата (оклад + % от своей
    комиссии + % от суммарной комиссии остальных держателей плана в этом
    месяце — см. MonthlyPlan). `managers=None` — по всем, у кого есть план;
    «остальные» считаются от полного набора за месяц независимо от фильтра,
    чтобы личная строка менеджера не искажала долю чужой комиссии."""
    all_plans = list(MonthlyPlan.objects.filter(year=year, month=month).select_related('manager'))
    commissions = {plan.manager_id: actual_commission_for_month(plan.manager, year, month) for plan in all_plans}
    total_commission = sum(commissions.values(), Decimal('0'))

    plans = all_plans if managers is None else [p for p in all_plans if p.manager in managers]

    rows = []
    for plan in plans:
        actual = commissions[plan.manager_id]
        target = plan.target_commission
        other_commission = total_commission - actual
        salary = (
            plan.base_salary
            + (plan.commission_percent / Decimal('100')) * Decimal(actual)
            + (plan.bonus_percent / Decimal('100')) * Decimal(other_commission)
        )
        rows.append({
            'manager_id': plan.manager_id,
            'manager_name': plan.manager.get_full_name() or plan.manager.username,
            'target': target,
            'actual': actual,
            'percent': round(float(actual) / float(target) * 100, 1) if target else 0,
            'salary': salary,
        })
    return rows


class PlanView(APIView):
    """План/факт по комиссии на месяц: своя строка для менеджера, все строки для руководителя."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        try:
            year = int(request.query_params.get('year', today.year))
            month = int(request.query_params.get('month', today.month))
        except ValueError:
            year, month = today.year, today.month

        head = is_head(request.user)
        rows = plan_progress_rows(year, month, managers=None if head else [request.user])

        return Response({
            'year': year,
            'month': month,
            'rows': rows,
            'target_total': sum((r['target'] for r in rows), 0),
            'actual_total': sum((r['actual'] for r in rows), 0),
        })


# «В работе» = не финальные статусы обращения (Lead) + не архивные заявки U-ON
# (UonRequestRecord.is_archive) — у заявок нет отдельного поля «завершена»,
# U-ON архивирует запись, когда работа по ней закончена (решение заказчика,
# 24.08.2026).
OPEN_LEAD_STATUSES = [
    s for s in Lead.Status.values if s not in (Lead.Status.CLOSED_WON, Lead.Status.CLOSED_LOST)
]


def task_counts_data(user, head):
    """Число открытых задач с дедлайном сегодня и просроченных — не заходит в
    последнюю колонку доски («Готово»), как и утренняя сводка в боте
    (telegrambot.tasks.notify_daily_deadlines)."""
    from kanban.models import KanbanColumn, Task

    today = timezone.localdate()
    qs = Task.objects.filter(deadline__isnull=False, deadline__date__lte=today)
    last_column = KanbanColumn.objects.order_by('-order').first()
    if last_column is not None:
        qs = qs.exclude(column_id=last_column.pk)
    if not head:
        qs = qs.filter(assignee=user)

    return {
        'today': qs.filter(deadline__date=today).count(),
        'overdue': qs.filter(deadline__date__lt=today).count(),
    }


def work_summary_data(user, head):
    from integrations.models import UonRequestRecord

    leads_qs = Lead.objects.filter(status__in=OPEN_LEAD_STATUSES)
    requests_qs = UonRequestRecord.objects.filter(is_archive=False)

    if not head:
        leads_qs = leads_qs.filter(assigned_manager=user)
        # У заявки нет FK на менеджера — только имя, синхронизированное из U-ON
        # (см. integrations.tasks._match_manager_user). Тот же способ сопоставления
        # применён и здесь, только в обратную сторону — от пользователя к записям.
        requests_qs = requests_qs.filter(manager_name__istartswith=user.first_name) if user.first_name else requests_qs.none()

    lead_counts = {row['status']: row['count'] for row in leads_qs.values('status').annotate(count=Count('id'))}
    leads_by_status = [
        {'status': status, 'status_display': label, 'count': lead_counts.get(status, 0)}
        for status, label in Lead.Status.choices
        if status in OPEN_LEAD_STATUSES
    ]

    request_counts = requests_qs.values('status_name').annotate(count=Count('id')).order_by('-count')
    requests_by_status = [
        {'status_name': row['status_name'] or 'Без статуса', 'count': row['count']} for row in request_counts
    ]

    return {
        'leads_total': leads_qs.count(),
        'leads_by_status': leads_by_status,
        'requests_total': requests_qs.count(),
        'requests_by_status': requests_by_status,
        'tasks': task_counts_data(user, head),
    }


class WorkSummaryView(APIView):
    """Сводка «в работе»: обращения (Lead) + заявки (U-ON) — своя для менеджера,
    по всему офису для руководителя."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(work_summary_data(request.user, is_head(request.user)))
