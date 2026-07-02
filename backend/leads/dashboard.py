from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import is_head

from .models import Lead

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

    paid_leads = period_leads.filter(status=Lead.Status.PAID)
    totals = paid_leads.aggregate(commission=Sum('commission'), deal_amount=Sum('deal_amount'))

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
                    status=Lead.Status.PAID, assigned_manager__isnull=False,
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
