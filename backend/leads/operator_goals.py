import re
from decimal import Decimal

from .management_dashboard import CLOSED_STATUSES, period_bounds, recognized_revenue_dates
from .models import Lead


BOOKING_STATUSES = [
    Lead.Status.BOOKED, Lead.Status.PREPAID, Lead.Status.WAITING_PAYMENT,
    Lead.Status.PAID, Lead.Status.DEPARTURE, Lead.Status.CHECK_IN,
    Lead.Status.RETURNED, Lead.Status.CLOSED_WON,
]
ALIASES = {
    'russianExpress': {'русскийэкспресс', 'russianexpress'},
    'resort': {'resort', 'resortholiday', 'резорт', 'резортхолидэй', 'резортхолидей'},
    'space': {'space', 'spacetravel', 'спейс', 'спейстревел', 'спейстрэвел'},
}


def _key(name):
    words = re.sub(r'[^a-zа-я0-9]+', ' ', (name or '').lower().replace('ё', 'е')).split()
    if words and words[0] in {'ооо', 'зао', 'ао', 'пао', 'ип'}:
        words = words[1:]
    compact = ''.join(words)
    return next((key for key, aliases in ALIASES.items() if compact in aliases), None)


def operator_progress(goals):
    targets = [
        ('russianExpress', 'Русский Экспресс', goals.russian_express_target),
        ('resort', 'Резорт', goals.resort_target),
        ('space', 'Спейс', goals.space_target),
    ]
    rows = {key: {'key': key, 'name': name, 'target': float(target), 'amount': Decimal('0'),
                  'bookings_count': 0, 'counted_count': 0, 'missing_count': 0}
            for key, name, target in targets if target is not None}
    if not rows:
        return []
    start, end, _ = period_bounds('custom_month', year=goals.year, month=goals.month)
    cancelled = [status for status in CLOSED_STATUSES if status != Lead.Status.CLOSED_WON]
    candidates = Lead.objects.exclude(status__in=cancelled)
    dates = recognized_revenue_dates(candidates, start, end, statuses=BOOKING_STATUSES)
    for lead in candidates.filter(pk__in=dates).select_related('tour_operator_ref'):
        if lead.tour_operator_ref_id:
            key = _key(lead.tour_operator_ref.brand_name) or _key(lead.tour_operator_ref.legal_name)
        else:
            key = _key(lead.tour_operator)
        if key not in rows:
            continue
        row = rows[key]
        row['bookings_count'] += 1
        amount = lead.deal_amount
        if amount is None or amount < 0:
            row['missing_count'] += 1
            continue
        if lead.tour_currency != Lead.Currency.RUB:
            if not lead.payment_exchange_rate or lead.payment_exchange_rate <= 0:
                row['missing_count'] += 1
                continue
            amount *= lead.payment_exchange_rate
        row['amount'] += amount
        row['counted_count'] += 1
    for row in rows.values():
        row['amount'] = (None if row['bookings_count'] and not row['counted_count']
                         else float(row['amount'].quantize(Decimal('0.01'))))
    return list(rows.values())
