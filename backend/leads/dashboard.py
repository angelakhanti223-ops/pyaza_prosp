from calendar import monthrange
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import is_head

from .models import CommissionTier, Lead, LeadStatusHistory, MonthlyPlan, WorkShift

# Порядок этапов воронки для конверсии (ТЗ 7). Закрытые "в отказ" заявки не
# входят в положительную воронку — это отдельный, негативный, исход.
FUNNEL_STAGES = [
    Lead.Status.NEW,
    Lead.Status.IN_PROGRESS,
    Lead.Status.OPTIONS_PROPOSED,
    Lead.Status.BOOKED,
    Lead.Status.PREPAID,
    Lead.Status.PAID,
    Lead.Status.CLOSED_WON,
]

# «Денежные» статусы — начиная с предоплаты часть комиссии уже причитается
# (решение заказчика, 08.09.2026), поэтому все три статуса засчитываются в
# комиссию за период, а не только «Закрыта (успех)».
REVENUE_STATUSES = [Lead.Status.PREPAID, Lead.Status.PAID, Lead.Status.CLOSED_WON]


def month_bounds(year, month):
    """Границы календарного месяца в текущей таймзоне проекта (Europe/Moscow)."""
    start = timezone.make_aware(datetime(year, month, 1))
    last_day = monthrange(year, month)[1]
    end = timezone.make_aware(datetime(year, month, last_day, 23, 59, 59, 999999))
    return start, end


def _revenue_recognized_qs(base_qs, date_from, date_to):
    """Заявки (в рамках base_qs), у которых комиссия ВПЕРВЫЕ признана в этом
    периоде — по дате ПЕРВОГО перехода в один из денежных статусов
    (REVENUE_STATUSES: предоплата / оплата / закрыта-успех), а не по дате
    создания заявки. Раньше денежные показатели дашборда (commission_total и
    т.д.) считались из period_leads (created_at внутри периода), из-за чего
    сделка, реально закрытая в этом месяце по заявке, заведённой раньше,
    выпадала из «Комиссии за период» — те же деньги План/факт (ниже,
    actual_commission_for_month) уже показывал корректно, теперь это одна
    и та же логика (решение заказчика, 02.09.2026).

    Берём именно ПЕРВЫЙ денежный переход, а не любой: с 08.09.2026 сделка
    обычно проходит все три денежных статуса подряд (предоплата → полная
    оплата → закрытие), и если считать каждый переход отдельно, один и тот же
    доход попал бы в комиссию за несколько месяцев подряд."""
    candidate_ids = base_qs.filter(
        Q(status__in=REVENUE_STATUSES) | Q(status_history__new_status__in=REVENUE_STATUSES),
    ).values_list('id', flat=True).distinct()

    first_recognized_at = {}
    for lead_id, changed_at in (
        LeadStatusHistory.objects.filter(lead_id__in=candidate_ids, new_status__in=REVENUE_STATUSES)
        .order_by('lead_id', 'changed_at')
        .values_list('lead_id', 'changed_at')
    ):
        first_recognized_at.setdefault(lead_id, changed_at)

    # LeadStatusHistory заполняется только в LeadViewSet.partial_update — заявка,
    # переведённая в обход CRM (например, правкой статуса в Django admin или
    # прямым апдейтом в БД), не оставит там записи и молча выпала бы из
    # комиссии за месяц. Для таких заявок берём updated_at как разумную оценку
    # момента признания — это подстраховка, а не основной путь.
    recognized_ids = set()
    for lead_id, status, updated_at in base_qs.filter(id__in=candidate_ids).values_list('id', 'status', 'updated_at'):
        recognized_at = first_recognized_at.get(lead_id)
        if recognized_at is None and status in REVENUE_STATUSES:
            recognized_at = updated_at
        if recognized_at is not None and date_from <= recognized_at <= date_to:
            recognized_ids.add(lead_id)

    return base_qs.filter(id__in=recognized_ids)


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

    # Предоплата / оплата / закрытие успехом — все три «денежные» стадии сделки:
    # часть комиссии причитается уже с предоплаты (решение заказчика,
    # 08.09.2026). Считаем по дате ПЕРВОГО денежного перехода (см.
    # _revenue_recognized_qs), не по дате создания заявки — иначе сделка,
    # заведённая в прошлом периоде и оплаченная в этом, не попала бы в
    # комиссию за период.
    won_leads = _revenue_recognized_qs(base_qs, date_from, date_to)
    totals = won_leads.aggregate(
        commission_sum=Sum('commission'), deal_amount_sum=Sum('deal_amount'),
        avg_deal_amount=Avg('deal_amount'), avg_commission=Avg('commission'),
        deals_count=Count('id'),
    )

    by_direction = (
        won_leads.exclude(direction__isnull=True)
        .values('direction__name')
        .annotate(count=Count('id'))
        .order_by('-count')
    )

    # Полный ряд по дням месяца, а не только дни, где есть заявки — иначе
    # график «прыгает» через пропуски и выглядит как будто данных меньше,
    # чем на самом деле (решение заказчика, 07.09.2026). Для ТЕКУЩЕГО месяца
    # обрываем на сегодняшнем дне — дни впереди ещё не наступили, рисовать под
    # них пустые столбцы нет смысла; для прошлого месяца date_to уже в
    # прошлом, так что last_day остаётся его последним днём как есть.
    daily_counts = {
        row['day']: row['count']
        for row in period_leads.annotate(day=TruncDate('created_at')).values('day').annotate(count=Count('id'))
    }
    first_day = date_from.date()
    last_day = min(date_to.date(), timezone.localdate())
    daily_dynamics = []
    day = first_day
    while day <= last_day:
        daily_dynamics.append({'date': day.isoformat(), 'count': daily_counts.get(day, 0)})
        day += timedelta(days=1)

    return {
        'new_leads_count': total,
        'leads_by_status': leads_by_status,
        'conversion': conversion,
        'commission_total': totals['commission_sum'] or 0,
        'deal_amount_total': totals['deal_amount_sum'] or 0,
        'deals_count': totals['deals_count'],
        'avg_deal_amount': totals['avg_deal_amount'] or 0,
        'avg_commission': totals['avg_commission'] or 0,
        'by_direction': [
            {'direction': row['direction__name'], 'count': row['count']} for row in by_direction
        ],
        'daily_dynamics': daily_dynamics,
    }


class DashboardView(APIView):
    """Сводная панель (ТЗ 7): личная — для менеджера, по отделу — для руководителя."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Раньше это было плавающее окно 7/30/90 дней от текущего момента — не
        # совпадало с тем, как считается план (календарный месяц), и запутывало:
        # заявка, заведённая до окна, но закрытая внутри него, всё равно не
        # покрывалась «по дате создания» логикой ниже. Теперь только два
        # календарных месяца — текущий и прошлый (решение заказчика, 02.09.2026).
        today = timezone.localdate()
        if request.query_params.get('period') == 'last_month':
            year, month = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
        else:
            year, month = today.year, today.month
        date_from, date_to = month_bounds(year, month)

        head = is_head(request.user)
        manager_filter = request.query_params.get('manager')

        base_qs = Lead.objects.all()
        if not head:
            base_qs = base_qs.filter(assigned_manager=request.user)
        elif manager_filter:
            base_qs = base_qs.filter(assigned_manager_id=manager_filter)

        data = _compute(base_qs, date_from, date_to)
        data['period'] = {'from': date_from.isoformat(), 'to': date_to.isoformat(), 'year': year, 'month': month}
        data['scope'] = 'department' if (head and not manager_filter) else 'personal'

        if head and not manager_filter:
            by_manager = (
                _revenue_recognized_qs(Lead.objects.filter(assigned_manager__isnull=False), date_from, date_to)
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


def actual_commission_for_month(manager, year, month):
    """Комиссия менеджера, засчитанная в план месяца — по дате ПЕРВОГО денежного
    перехода (предоплата / оплата / закрыта-успех, см. _revenue_recognized_qs
    и REVENUE_STATUSES), а не по дате создания заявки. С предоплаты часть
    комиссии причитается уже тогда (решение заказчика, 08.09.2026)."""
    start, end = month_bounds(year, month)
    qs = _revenue_recognized_qs(Lead.objects.filter(assigned_manager=manager), start, end)
    return qs.aggregate(total=Sum('commission'))['total'] or 0


def _tier_lookup(actual, tiers):
    """tiers — CommissionTier по возрастанию threshold. Возвращает (достигнутый
    уровень или None, следующий уровень или None, % от своей комиссии).
    Ниже порога самого нижнего уровня всё равно действует его %, а «следующий»
    уровень для прогресс-бара — этот же нижний (решение заказчика, 07.09.2026:
    единая лестница уровней на всех менеджеров вместо персонального target_commission
    и commission_percent на MonthlyPlan)."""
    if not tiers:
        return None, None, Decimal('0')

    reached = None
    for tier in tiers:
        if actual >= tier.threshold:
            reached = tier
        else:
            break

    if reached is None:
        return None, tiers[0], tiers[0].commission_percent

    next_tier = next((t for t in tiers if t.threshold > reached.threshold), None)
    return reached, next_tier, reached.commission_percent


def plan_progress_rows(year, month, managers=None):
    """Строки план/факт по комиссии за месяц + зарплата (оклад + % от своей
    комиссии по достигнутому уровню CommissionTier + % от суммарной комиссии
    остальных держателей плана в этом месяце — см. MonthlyPlan/CommissionTier).
    `managers=None` — по всем, у кого есть план; «остальные» считаются от
    полного набора за месяц независимо от фильтра, чтобы личная строка
    менеджера не искажала долю чужой комиссии."""
    all_plans = list(MonthlyPlan.objects.filter(year=year, month=month).select_related('manager'))
    commissions = {plan.manager_id: actual_commission_for_month(plan.manager, year, month) for plan in all_plans}
    total_commission = sum(commissions.values(), Decimal('0'))
    tiers = list(CommissionTier.objects.order_by('threshold'))

    plans = all_plans if managers is None else [p for p in all_plans if p.manager in managers]

    rows = []
    for plan in plans:
        actual = commissions[plan.manager_id]
        other_commission = total_commission - actual
        reached_tier, next_tier, commission_percent = _tier_lookup(Decimal(actual), tiers)
        target = next_tier.threshold if next_tier else (reached_tier.threshold if reached_tier else Decimal('0'))

        salary = (
            plan.base_salary
            + (commission_percent / Decimal('100')) * Decimal(actual)
            + (plan.bonus_percent / Decimal('100')) * Decimal(other_commission)
        )
        rows.append({
            'manager_id': plan.manager_id,
            'manager_name': plan.manager.get_full_name() or plan.manager.username,
            'target': target,
            'actual': actual,
            'percent': round(float(actual) / float(target) * 100, 1) if target else 0,
            'salary': salary,
            'tier_name': reached_tier.name if reached_tier else None,
            'next_tier_name': next_tier.name if next_tier else None,
            'commission_percent': commission_percent,
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


def work_schedule_rows(year, month):
    """Рабочий график на месяц, сгруппированный в диапазоны подряд идущих дней
    одного менеджера (как в таблице, которую руководитель ведёт вручную) —
    отдельные записи WorkShift редактируются в Django admin по одной на день,
    здесь только группировка для отображения (ТЗ 07.09.2026)."""
    start, end = month_bounds(year, month)
    shifts = list(
        WorkShift.objects.filter(date__gte=start.date(), date__lte=end.date())
        .select_related('manager').order_by('date'),
    )

    rows = []
    for shift in shifts:
        last = rows[-1] if rows else None
        if last and last['manager_id'] == shift.manager_id and (shift.date - last['date_to']).days == 1:
            last['date_to'] = shift.date
            last['days'] += 1
        else:
            rows.append({
                'manager_id': shift.manager_id,
                'manager_name': shift.manager.get_full_name() or shift.manager.username,
                'date_from': shift.date,
                'date_to': shift.date,
                'days': 1,
            })

    return [
        {**row, 'date_from': row['date_from'].isoformat(), 'date_to': row['date_to'].isoformat()}
        for row in rows
    ]


class WorkScheduleView(APIView):
    """Рабочий график на месяц (кто в какие дни на смене) — блок внизу дашборда."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        try:
            year = int(request.query_params.get('year', today.year))
            month = int(request.query_params.get('month', today.month))
        except ValueError:
            year, month = today.year, today.month

        return Response({'year': year, 'month': month, 'rows': work_schedule_rows(year, month)})
