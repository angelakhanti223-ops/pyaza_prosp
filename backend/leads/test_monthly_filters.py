from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase

from .dashboard import _compute, actual_commission_for_month, month_bounds
from .models import Lead, LeadStatusHistory


def at(year, month, day, hour=12):
    return datetime(year, month, day, hour, tzinfo=ZoneInfo('Europe/Moscow'))


class MonthlyLeadFilterTests(TestCase):
    def setUp(self):
        clock = patch('leads.monthly_filters.timezone.now', return_value=at(2026, 11, 24))
        self.now = clock.start()
        self.addCleanup(clock.stop)
        self.manager = get_user_model().objects.create_user(username='month-manager', role='manager')
        self.other = get_user_model().objects.create_user(username='month-other', role='manager')
        self.client.force_login(self.manager)
        self.start, self.end = month_bounds(2026, 11)

    def lead(self, status='new', updated=None, manager=None, name='Проверка', commission=1000):
        lead = Lead.objects.create(name=name, phone='+79990000000', status=status,
                                   assigned_manager=manager or self.manager, commission=commission)
        Lead.objects.filter(pk=lead.pk).update(created_at=at(2026, 8, 1), updated_at=updated or at(2026, 11, 20))
        return lead

    def transition(self, lead, status, when):
        record = LeadStatusHistory.objects.create(lead=lead, new_status=status)
        LeadStatusHistory.objects.filter(pk=record.pk).update(changed_at=when)

    def rows(self, kind=None, **params):
        if kind:
            params['month_filter'] = kind
        response = self.client.get('/api/crm/leads/', params)
        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        return payload['results'] if isinstance(payload, dict) else payload

    def ids(self, kind=None, **params):
        return {row['id'] for row in self.rows(kind, **params)}

    def test_sales_match_commission_and_dashboard_including_older_leads_and_history(self):
        prepaid = self.lead('prepaid')
        self.transition(prepaid, 'prepaid', self.start)
        returned = self.lead('returned')
        self.transition(returned, 'paid', self.end)
        cancelled = self.lead('failed')
        self.transition(cancelled, 'prepaid', at(2026, 11, 5))
        fallback = self.lead('paid', updated=at(2026, 11, 9), commission=Decimal('1234.50'))
        previous = self.lead('closed_won')
        self.transition(previous, 'prepaid', self.start - timedelta(microseconds=1))
        self.transition(previous, 'paid', at(2026, 11, 8))
        self.transition(previous, 'closed_won', at(2026, 11, 19))
        self.lead('paid', updated=self.end + timedelta(microseconds=1))
        self.lead('new')
        self.assertEqual(self.ids('sales'), {prepaid.pk, returned.pk, cancelled.pk, fallback.pk})
        total = sum(Decimal(row['commission']) for row in self.rows('sales'))
        self.assertEqual(total, actual_commission_for_month(self.manager, 2026, 11))
        self.assertEqual(total, _compute(Lead.objects.all(), self.start, self.end)['commission_total'])

    def test_failures_use_status_transition_not_creation_or_unrelated_edit(self):
        failed = self.lead('failed')
        self.transition(failed, 'failed', self.start)
        lost = self.lead('closed_lost')
        self.transition(lost, 'closed_lost', self.end)
        previous = self.lead('failed', updated=at(2026, 11, 24))
        self.transition(previous, 'failed', self.start - timedelta(microseconds=1))
        future = self.lead('failed')
        self.transition(future, 'failed', self.end + timedelta(microseconds=1))
        reopened = self.lead('selection')
        self.transition(reopened, 'failed', at(2026, 11, 4))
        not_target = self.lead('not_target')
        self.transition(not_target, 'not_target', at(2026, 11, 4))
        self.assertEqual(self.ids('failures'), {failed.pk, lost.pk})

    def test_failures_count_latest_transition_into_current_status_and_fallback(self):
        repeated = self.lead('failed')
        self.transition(repeated, 'failed', at(2026, 10, 1))
        self.transition(repeated, 'selection', at(2026, 11, 2))
        self.transition(repeated, 'failed', at(2026, 11, 5))
        fallback = self.lead('closed_lost', updated=at(2026, 11, 12))
        self.lead('failed', updated=at(2026, 10, 5))
        self.assertEqual(self.ids('failures'), {repeated.pk, fallback.pk})

    def test_calendar_month_is_moscow_including_short_months_and_new_year(self):
        for year, month in [(2026, 11), (2027, 2), (2028, 2), (2027, 1)]:
            with self.subTest(year=year, month=month):
                Lead.objects.all().delete()
                self.now.return_value = at(year, month, 15)
                self.client.force_login(self.manager)
                start, end = month_bounds(year, month)
                first = self.lead('paid', updated=start)
                last = self.lead('paid', updated=end)
                self.lead('paid', updated=start - timedelta(microseconds=1))
                self.lead('paid', updated=end + timedelta(microseconds=1))
                self.assertEqual(self.ids('sales'), {first.pk, last.pk})
                self.assertEqual(start.astimezone(ZoneInfo('UTC')).hour, 21)

    def test_filters_preserve_search_status_manager_and_unfiltered_list(self):
        target = self.lead('prepaid', name='Нужная заявка')
        other = self.lead('prepaid', manager=self.other)
        failed = self.lead('failed')
        self.assertEqual(self.ids('sales', search='Нужная', status='prepaid'), {target.pk})
        self.assertEqual(self.ids('sales', assigned_manager=self.other.pk), {other.pk})
        self.assertEqual(self.ids(), {target.pk, other.pk, failed.pk})
        self.assertEqual(self.client.get('/api/crm/leads/', {'month_filter': 'unknown'}).status_code, 400)

    def test_filter_requires_authentication(self):
        self.client.logout()
        self.assertIn(self.client.get('/api/crm/leads/', {'month_filter': 'sales'}).status_code, (401, 403))
