from django.db.models import F, OuterRef, Subquery
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .dashboard import _revenue_recognized_qs, month_bounds
from .models import Lead, LeadStatusHistory


def filter_current_month(queryset, kind):
    """Use the plan/dashboard revenue month, not the lead's creation month."""
    if kind not in ('sales', 'failures'):
        raise ValidationError({'month_filter': 'Выберите sales или failures.'})
    today = timezone.localdate()
    start, end = month_bounds(today.year, today.month)
    if kind == 'sales':
        return _revenue_recognized_qs(queryset, start, end)

    # Reopened leads are excluded. For a repeated failure use the most recent
    # transition into the current failure status, not an unrelated later edit.
    latest_failure = LeadStatusHistory.objects.filter(
        lead_id=OuterRef('pk'), new_status=OuterRef('status'),
    ).order_by('-changed_at', '-pk').values('changed_at')[:1]
    return queryset.filter(status__in=[Lead.Status.FAILED, Lead.Status.CLOSED_LOST]).alias(
        failure_at=Coalesce(Subquery(latest_failure), F('updated_at')),
    ).filter(failure_at__gte=start, failure_at__lte=end)
