from datetime import datetime
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from .models import Lead, LeadStatusHistory


def at(month, day, hour=12):
    return timezone.make_aware(datetime(2026, month, day, hour))


class ManagementConversionTests(TestCase):
    def setUp(self):
        self.clock = patch('leads.management_dashboard.timezone.now', return_value=at(10, 25))
        self.clock.start(); self.addCleanup(self.clock.stop)
        self.owner = get_user_model().objects.create_user(username='conversion-owner', role='head')
        self.other = get_user_model().objects.create_user(username='conversion-manager', role='manager')
        self.client.force_login(self.owner)

    def lead(self, status='new', created=None, sale=None, manager=None, source='site_form'):
        lead = Lead.objects.create(name='Проверка конверсии', status=status, assigned_manager=manager or self.owner, source=source, commission=1000)
        Lead.objects.filter(pk=lead.pk).update(created_at=created or at(10, 3), updated_at=sale or at(10, 25))
        if sale:
            history = LeadStatusHistory.objects.create(lead=lead, old_status='selection', new_status='prepaid')
            LeadStatusHistory.objects.filter(pk=history.pk).update(changed_at=sale)
        return lead

    def data(self, period='current_month'):
        response = self.client.get('/api/crm/management-dashboard/', {'period': period})
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def test_denominator_keeps_closed_won_lost_and_all_current_stages(self):
        for status in ['new', 'selection', 'closed_lost', 'failed', 'not_target']:
            self.lead(status)
        self.lead('closed_won', sale=at(10, 12))
        data = self.data()
        self.assertEqual(data['conversion'], {'sold_count': 1, 'incoming_count': 6, 'percent': 16.7, 'previous_period_sales_count': 0})
        self.assertEqual(data['manager_rows'][0]['new_leads'], 6)
        self.assertEqual(data['manager_rows'][0]['conversion_percent'], 16.7)
        self.assertEqual(data['source_rows'][0]['conversion_percent'], 16.7)
        self.assertEqual(sum(row['leads'] for row in data['daily_rows']), 6)

    def test_moving_new_lead_to_selection_does_not_change_denominator(self):
        lead = self.lead()
        self.lead('prepaid', sale=at(10, 5))
        before = self.data()
        lead.status = 'selection'; lead.save()
        after = self.data()
        self.assertEqual(before['conversion'], after['conversion'])
        self.assertEqual(after['manager_rows'][0]['new_leads'], 2)
        self.assertEqual(after['manager_rows'][0]['conversion_percent'], 50)

    def test_previous_period_sales_are_retained_and_explained(self):
        self.lead('prepaid', created=at(9, 1), sale=at(10, 2))
        self.lead('selection')
        data = self.data()
        self.assertEqual(data['conversion'], {'sold_count': 1, 'incoming_count': 1, 'percent': 100, 'previous_period_sales_count': 1})
        self.assertEqual(data['money']['commission_total'], 1000)
        self.assertEqual(data['money']['deals_count'], 1)

    def test_zero_incoming_is_undefined_even_if_old_leads_sell(self):
        self.lead('paid', created=at(9, 1), sale=at(10, 2), source='phone_call')
        data = self.data()
        self.assertEqual(data['conversion']['sold_count'], 1)
        self.assertEqual(data['conversion']['incoming_count'], 0)
        self.assertIsNone(data['conversion']['percent'])
        self.assertIsNone(data['manager_rows'][0]['conversion_percent'])
        self.assertEqual(data['source_rows'][0]['source'], 'phone_call')
        self.assertEqual(data['source_rows'][0]['sold'], 1)
        self.assertEqual(data['source_rows'][0]['count'], 0)
        self.assertIsNone(data['source_rows'][0]['conversion_percent'])

    def test_empty_period_does_not_invent_zero_percent(self):
        data = self.data()
        self.assertEqual(data['conversion']['incoming_count'], 0)
        self.assertEqual(data['conversion']['sold_count'], 0)
        self.assertIsNone(data['conversion']['percent'])

    def test_zero_sales_with_incoming_is_zero_percent(self):
        self.lead('selection')
        self.assertEqual(self.data()['conversion']['percent'], 0)

    def test_flow_ratio_is_not_clamped_when_old_sales_exceed_incoming(self):
        self.lead('selection')
        for day in [1, 2]:
            self.lead('paid', created=at(9, day), sale=at(10, day))
        self.assertEqual(self.data()['conversion']['percent'], 200)

    def test_first_money_transition_counts_once_and_not_again_next_month(self):
        lead = self.lead('paid', created=at(9, 1), sale=at(9, 5))
        history = LeadStatusHistory.objects.create(lead=lead, old_status='prepaid', new_status='paid')
        LeadStatusHistory.objects.filter(pk=history.pk).update(changed_at=at(10, 2))
        self.assertEqual(self.data()['conversion']['sold_count'], 0)
        self.assertEqual(self.data('last_month')['conversion']['sold_count'], 1)

    def test_one_sale_with_repeated_money_statuses_is_not_duplicated(self):
        lead = self.lead('paid', sale=at(10, 3))
        LeadStatusHistory.objects.create(lead=lead, old_status='prepaid', new_status='paid')
        self.assertEqual(self.data()['conversion']['sold_count'], 1)

    def test_period_choice_applies_to_both_terms_of_ratio(self):
        self.lead('prepaid', created=at(10, 2), sale=at(10, 2))
        self.lead('selection', created=at(10, 21))
        self.lead('paid', created=at(9, 2), sale=at(9, 4))
        self.assertEqual(self.data()['conversion']['percent'], 50)
        self.assertEqual(self.data('current_week')['conversion']['percent'], 0)
        self.assertEqual(self.data('last_month')['conversion']['percent'], 100)
        self.assertEqual(self.data('current_year')['conversion']['percent'], 66.7)

    def test_manager_totals_match_the_office_denominator(self):
        self.lead('prepaid', sale=at(10, 3))
        self.lead('selection', manager=self.other)
        self.lead('closed_lost', manager=self.other)
        data = self.data()
        self.assertEqual(sum(row['new_leads'] for row in data['manager_rows']), data['conversion']['incoming_count'])
        rows = {row['manager_id']: row for row in data['manager_rows']}
        self.assertEqual(rows[self.owner.pk]['conversion_percent'], 100)
        self.assertEqual(rows[self.other.pk]['conversion_percent'], 0)

    def test_legacy_money_record_without_history_keeps_revenue_fallback(self):
        self.lead('prepaid', sale=None)
        self.assertEqual(self.data()['conversion']['sold_count'], 1)

    def test_access_stays_restricted_to_management(self):
        self.client.force_login(self.other)
        self.assertEqual(self.client.get('/api/crm/management-dashboard/').status_code, 403)
