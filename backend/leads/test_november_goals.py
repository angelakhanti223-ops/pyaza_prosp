from datetime import date, datetime
from importlib import import_module
from types import SimpleNamespace
from unittest.mock import patch

from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import Client, TestCase
from django.utils import timezone

from .models import Lead, LeadStatusHistory, OfficeGoals, WorkShift


def at(month, day, hour=12):
    return timezone.make_aware(datetime(2026, month, day, hour))


class NovemberGoalsTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username='goals-owner', role='head')
        self.client.force_login(self.owner)

    def sale(self, month, day, amount=100000, commission=9000, currency='RUB'):
        lead = Lead.objects.create(
            name='Проверка ноября', status='prepaid', commission=commission,
            deal_amount=amount, tour_currency=currency,
        )
        Lead.objects.filter(pk=lead.pk).update(created_at=at(month, day), updated_at=at(month, day))
        history = LeadStatusHistory.objects.create(lead=lead, new_status='prepaid')
        LeadStatusHistory.objects.filter(pk=history.pk).update(changed_at=at(month, day))
        return lead

    def november(self):
        return self.client.get('/api/crm/management-dashboard/', {'period': 'custom_month', 'year': 2026, 'month': 11})

    def test_november_is_fixed_across_current_month_changes_and_includes_month_edges(self):
        self.sale(10, 31)
        self.sale(11, 1)
        self.sale(11, 30)
        self.sale(12, 1)
        for current in [at(10, 31), at(12, 15)]:
            with self.subTest(current=current), patch('leads.management_dashboard.timezone.now', return_value=current):
                self.client.force_login(self.owner)
                response = self.november()
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertEqual(data['conversion']['incoming_count'], 2)
                self.assertEqual(data['money']['deals_count'], 2)
                self.assertEqual(data['money']['deal_amount_total'], 200000)
                self.assertEqual(data['period']['code'], 'custom_month')
                self.assertTrue(data['period']['from'].startswith('2026-11-01'))
                self.assertTrue(data['period']['to'].startswith('2026-11-30'))

    def test_weighted_rate_uses_matching_complete_ruble_records(self):
        self.sale(11, 1, amount=100000, commission=5000)
        self.sale(11, 2, amount=300000, commission=33000)
        self.sale(11, 3, amount=500000, commission=None)
        self.sale(11, 4, amount=None, commission=10000)
        self.sale(11, 5, amount=1000, commission=100, currency='USD')
        data = self.november().json()['money']
        self.assertEqual(data['commission_rate_percent'], 9.5)
        self.assertEqual(data['commission_rate_deals_count'], 2)

    def test_no_rate_without_complete_records_but_zero_commission_is_valid(self):
        self.sale(11, 1, commission=None)
        self.assertIsNone(self.november().json()['money']['commission_rate_percent'])
        self.sale(11, 2, commission=0)
        self.assertEqual(self.november().json()['money']['commission_rate_percent'], 0)

    def test_invalid_or_incomplete_month_is_rejected(self):
        for params in [
            {'period': 'custom_month'}, {'year': 2026}, {'month': 11},
            {'year': 'bad', 'month': 11}, {'year': 2026, 'month': 13},
            {'year': 0, 'month': 11}, {'year': 2026, 'month': ''},
        ]:
            with self.subTest(params=params):
                self.assertEqual(self.client.get('/api/crm/management-dashboard/', params).status_code, 400)

    def test_manager_cannot_read_goals_actuals(self):
        manager = get_user_model().objects.create_user(username='goals-manager')
        self.client.force_login(manager)
        self.assertEqual(self.november().status_code, 403)


class NovemberScheduleTests(TestCase):
    def setUp(self):
        self.elena = get_user_model().objects.create_user(username='elena', first_name='Елена')
        self.katya = get_user_model().objects.create_user(username='ekaterina', first_name='Екатерина')
        self.seed = import_module('leads.migrations.0023_seed_november_2026_work_schedule').seed_november_schedule

    def run_seed(self):
        self.seed(apps, SimpleNamespace(connection=connection))

    def test_exact_3_by_3_schedule_and_repeated_run_preserve_other_months(self):
        october = WorkShift.objects.create(date=date(2026, 10, 31), manager=self.elena)
        WorkShift.objects.create(date=date(2026, 11, 1), manager=self.elena)
        self.run_seed()
        self.run_seed()
        rows = WorkShift.objects.filter(date__year=2026, date__month=11)
        self.assertEqual(rows.count(), 30)
        katya_days = [1, 2, 3, 7, 8, 9, 13, 14, 15, 19, 20, 21, 25, 26, 27]
        self.assertEqual(list(rows.filter(manager=self.katya).values_list('date__day', flat=True)), katya_days)
        self.assertEqual(rows.filter(manager=self.elena).count(), 15)
        october.refresh_from_db()
        self.assertEqual(october.manager_id, self.elena.pk)

    def test_missing_person_does_not_create_a_partial_schedule(self):
        self.katya.delete()
        with self.assertLogs(level='WARNING'):
            self.run_seed()
        self.assertFalse(WorkShift.objects.filter(date__month=11).exists())

    def test_admin_fallback_does_not_override_named_elena(self):
        get_user_model().objects.create_user(username='admin')
        self.run_seed()
        self.assertEqual(WorkShift.objects.get(date=date(2026, 11, 4)).manager_id, self.elena.pk)

    def test_ambiguous_names_are_not_assigned_arbitrarily(self):
        self.katya.username = 'renamed'
        self.katya.save()
        get_user_model().objects.create_user(username='another-katya', first_name='Екатерина')
        with self.assertRaises(RuntimeError):
            self.run_seed()
        self.assertFalse(WorkShift.objects.filter(date__month=11).exists())


class OfficeGoalsStorageTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username='office-goals-owner', role='head')
        self.client.force_login(self.owner)
        self.url = '/api/crm/office-goals/?year=2026&month=11'

    def test_seeded_months_remain_separate_and_october_keeps_original_meaning(self):
        november = self.client.get(self.url).json()
        october = self.client.get('/api/crm/office-goals/?year=2026&month=10').json()
        self.assertEqual(november['targets']['turnover'], 5000000)
        self.assertEqual(november['targets']['receipts'], 220000)
        self.assertEqual(november['targets']['commissionRate'], 9)
        self.assertEqual(november['targets']['leads'], 150)
        self.assertEqual(november['commission_basis'], 'cash_receipts')
        self.assertEqual(october['targets']['turnover'], 4000000)
        self.assertEqual(october['targets']['receipts'], 200000)
        self.assertEqual(october['targets']['leads'], 200)
        self.assertEqual(october['commission_basis'], 'bookings')
        self.assertEqual(len(october['activities']), 17)
        self.assertEqual(len(november['activities']), 15)
        self.assertIsNone(november['commission_receipts_actual'])

    def test_checkboxes_persist_across_reads_and_do_not_replace_other_marks(self):
        for identifier in ['thailand-katya', 'maldives-elena']:
            response = self.client.patch(self.url, {'activity_id': identifier, 'completed': True}, content_type='application/json')
            self.assertEqual(response.status_code, 200, response.content)
        stored = {a['id']: a['completed'] for a in self.client.get(self.url).json()['activities']}
        self.assertTrue(stored['thailand-katya'])
        self.assertTrue(stored['maldives-elena'])
        response = self.client.patch(self.url, {'activity_id': 'thailand-katya', 'completed': False}, content_type='application/json')
        self.assertFalse(next(a for a in response.json()['activities'] if a['id'] == 'thailand-katya')['completed'])
        self.assertFalse(any(a['completed'] for a in OfficeGoals.objects.get(month=10).activities))

    def test_receipts_are_manual_preserve_zero_and_can_be_cleared(self):
        for value in ['123456.78', '0', None]:
            response = self.client.patch(self.url, {'commission_receipts_actual': value}, content_type='application/json')
            self.assertEqual(response.status_code, 200, response.content)
            expected = float(value) if value is not None else None
            self.assertEqual(self.client.get(self.url).json()['commission_receipts_actual'], expected)
        self.assertEqual(self.client.patch(self.url, {'commission_receipts_actual': '-1'}, content_type='application/json').status_code, 400)

    def test_invalid_goal_does_not_partially_save_receipts(self):
        response = self.client.patch(self.url, {'activity_id': 'unknown', 'completed': True, 'commission_receipts_actual': '500'}, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertIsNone(OfficeGoals.objects.get(month=11).commission_receipts_actual)
        self.assertEqual(self.client.patch(self.url, {'completed': True}, content_type='application/json').status_code, 400)

    def test_repeated_seeding_preserves_manual_changes(self):
        goals = OfficeGoals.objects.get(month=11)
        goals.commission_receipts_actual = '1500'
        goals.activities[0]['completed'] = True
        goals.save()
        seed = import_module('leads.migrations.0025_seed_november_2026_office_goals').seed_november_goals
        seed(apps, SimpleNamespace(connection=connection))
        goals.refresh_from_db()
        self.assertEqual(float(goals.commission_receipts_actual), 1500)
        self.assertTrue(goals.activities[0]['completed'])

    def test_permissions_and_csrf_remain_required(self):
        secure = Client(enforce_csrf_checks=True)
        secure.force_login(self.owner)
        body = {'activity_id': 'thailand-katya', 'completed': True}
        self.assertEqual(secure.patch(self.url, body, content_type='application/json').status_code, 403)
        secure.get('/api/auth/csrf/')
        token = secure.cookies['csrftoken'].value
        self.assertEqual(secure.patch(self.url, body, content_type='application/json', HTTP_X_CSRFTOKEN=token).status_code, 200)
        manager = get_user_model().objects.create_user(username='office-goals-manager')
        self.client.force_login(manager)
        self.assertEqual(self.client.patch(self.url, body, content_type='application/json').status_code, 403)

    def test_unconfigured_month_is_not_filled_from_another_month(self):
        self.assertEqual(self.client.get('/api/crm/office-goals/?year=2026&month=9').status_code, 404)
        self.assertEqual(self.client.get('/api/crm/office-goals/?year=2026').status_code, 400)

