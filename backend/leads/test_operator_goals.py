from datetime import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from .models import Lead, LeadStatusHistory, OfficeGoals, TourOperator
from .operator_goals import operator_progress


def at(month, day):
    return timezone.make_aware(datetime(2026, month, day, 12))


class OperatorGoalsTests(TestCase):
    def setUp(self):
        self.goals = OfficeGoals.objects.get(year=2026, month=11)

    def booking(self, operator='Resort Holiday', month=11, amount='200000', status='booked', currency='RUB', rate=None, reference=True):
        fields = {'tour_operator_ref': TourOperator.objects.get(brand_name=operator)} if reference else {'tour_operator': operator}
        lead = Lead.objects.create(name='Проверка объёма ТО', status=status, deal_amount=amount, tour_currency=currency, payment_exchange_rate=rate, **fields)
        Lead.objects.filter(pk=lead.pk).update(created_at=at(10, 1), updated_at=at(month, 4))
        history = LeadStatusHistory.objects.create(lead=lead, new_status='booked')
        LeadStatusHistory.objects.filter(pk=history.pk).update(changed_at=at(month, 4))
        return lead

    def rows(self):
        return {row['key']: row for row in operator_progress(self.goals)}

    def test_each_operator_has_its_own_target_and_full_booking_amount(self):
        self.booking(amount='300000')
        self.booking(operator='Space Travel', amount='400000')
        self.booking(operator='Русский Экспресс', amount='800000')
        rows = self.rows()
        self.assertEqual(rows['resort']['target'], 500000)
        self.assertEqual(rows['space']['target'], 500000)
        self.assertEqual(rows['russianExpress']['target'], 1000000)
        self.assertEqual(rows['resort']['amount'], 300000)
        self.assertEqual(rows['space']['amount'], 400000)
        self.assertEqual(rows['russianExpress']['amount'], 800000)

    def test_period_uses_first_booking_not_prepayment_and_excludes_cancelled(self):
        earlier = self.booking(month=10)
        history = LeadStatusHistory.objects.create(lead=earlier, new_status='prepaid')
        LeadStatusHistory.objects.filter(pk=history.pk).update(changed_at=at(11, 4))
        self.booking(month=12)
        self.booking(status='closed_lost')
        self.booking(status='failed')
        self.booking(amount='125000')
        rows = self.rows()
        self.assertEqual(rows['resort']['amount'], 125000)
        self.assertEqual(rows['resort']['bookings_count'], 1)

    def test_reference_wins_over_stale_text_and_aliases_do_not_match_other_brands(self):
        lead = self.booking(operator='Space Travel', amount='100000')
        lead.tour_operator = 'Resort Holiday'
        lead.save()
        self.booking(operator='РЕЗОРТ', amount='250000', reference=False)
        self.booking(operator='ООО «Русский Экспресс»', amount='350000', reference=False)
        self.booking(operator='Space Resort Hotel', amount='999999', reference=False)
        rows = self.rows()
        self.assertEqual(rows['space']['amount'], 100000)
        self.assertEqual(rows['resort']['amount'], 250000)
        self.assertEqual(rows['russianExpress']['amount'], 350000)

    def test_currency_uses_saved_rate_and_reports_incomplete_records(self):
        self.booking(amount='1000', currency='USD', rate='90')
        self.booking(amount='1000', currency='USD')
        self.booking(amount=None)
        row = self.rows()['resort']
        self.assertEqual(row['amount'], 90000)
        self.assertEqual(row['missing_count'], 2)
        self.assertEqual(row['counted_count'], 1)
        self.assertEqual(row['bookings_count'], 3)

    def test_no_bookings_is_zero_but_missing_amount_is_not_zero(self):
        self.assertEqual(self.rows()['space']['amount'], 0)
        self.booking(amount=None)
        self.assertIsNone(self.rows()['resort']['amount'])

    def test_api_uses_selected_month_and_keeps_saved_checkmarks(self):
        self.booking()
        self.goals.activities[0]['completed'] = True
        self.goals.save()
        user = get_user_model().objects.create_user(username='operator-goals-owner', role='head')
        self.client.force_login(user)
        response = self.client.get('/api/crm/office-goals/?year=2026&month=11')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['operator_progress']), 3)
        self.assertTrue(response.json()['activities'][0]['completed'])
        october = self.client.get('/api/crm/office-goals/?year=2026&month=10').json()
        self.assertEqual(october['operator_progress'], [])
