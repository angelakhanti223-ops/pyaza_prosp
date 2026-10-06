import importlib
from decimal import Decimal
from types import SimpleNamespace

from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from .dashboard import PlanView, plan_progress_rows
from .models import Lead, MonthlyPlan


User = get_user_model()
restore_october_bonus = importlib.import_module('leads.migrations.0020_restore_ekaterina_october_bonus').restore_october_bonus


class SalaryBonusTests(TestCase):
    def setUp(self):
        self.head = User.objects.create_user(username='salary_head', role=User.Role.HEAD)
        self.manager = User.objects.create_user(username='salary_manager', role=User.Role.MANAGER)
        self.today = timezone.localdate()

    def plan(self, manager=None, **kwargs):
        return MonthlyPlan.objects.create(
            manager=manager or self.manager, year=self.today.year, month=self.today.month, **kwargs,
        )

    def commission(self, manager, value):
        return Lead.objects.create(name='Salary regression', assigned_manager=manager, commission=value, status=Lead.Status.CLOSED_WON)

    def row(self):
        return plan_progress_rows(self.today.year, self.today.month, managers=[self.manager])[0]

    def test_three_percent_from_head_without_head_plan(self):
        plan = self.plan()
        self.assertEqual(plan.bonus_percent, Decimal('3'))
        self.commission(self.head, Decimal('8732'))
        self.assertEqual(self.row()['salary'], Decimal('30261.96'))

    def test_superuser_is_also_a_head_even_with_default_role(self):
        admin = User.objects.create_user(username='salary_admin', is_superuser=True)
        self.plan()
        self.commission(admin, Decimal('8732'))
        self.assertEqual(self.row()['salary'], Decimal('30261.96'))

    def test_own_commission_and_head_bonus_are_both_in_salary(self):
        self.plan()
        self.commission(self.manager, Decimal('40000'))
        self.commission(self.head, Decimal('10000'))
        self.assertEqual(self.row()['salary'], Decimal('36300'))

    def test_plan_api_returns_the_bonus_in_selected_month(self):
        self.plan()
        self.commission(self.head, Decimal('8732'))
        request = APIRequestFactory().get('/api/crm/plan/', {'year': self.today.year, 'month': self.today.month})
        force_authenticate(request, user=self.manager)
        response = PlanView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['rows']), 1)
        self.assertEqual(response.data['rows'][0]['salary'], Decimal('30261.96'))

    def test_saved_reduced_percent_is_preserved_on_repeated_calculation(self):
        plan = self.plan(bonus_percent=Decimal('1'))
        self.commission(self.head, Decimal('8732'))
        self.assertEqual(self.row()['salary'], Decimal('30087.32'))
        self.assertEqual(self.row()['salary'], Decimal('30087.32'))
        plan.refresh_from_db()
        self.assertEqual(plan.bonus_percent, Decimal('1'))

    def test_saved_zero_percent_is_preserved(self):
        plan = self.plan(bonus_percent=Decimal('0'))
        self.commission(self.head, Decimal('8732'))
        self.assertEqual(self.row()['salary'], Decimal('30000'))
        plan.refresh_from_db()
        self.assertEqual(plan.bonus_percent, Decimal('0'))

    def test_other_manager_commission_does_not_inflate_bonus(self):
        other = User.objects.create_user(username='salary_other', role=User.Role.MANAGER)
        self.plan()
        self.plan(other)
        self.commission(other, Decimal('100000'))
        self.commission(self.head, Decimal('8732'))
        self.assertEqual(self.row()['salary'], Decimal('30261.96'))

    def test_head_does_not_receive_bonus_on_own_commission(self):
        self.plan(self.head)
        self.commission(self.head, Decimal('8732'))
        row = plan_progress_rows(self.today.year, self.today.month, managers=[self.head])[0]
        self.assertEqual(row['salary'], Decimal('31309.80'))

    def test_next_month_plan_defaults_back_to_three_percent(self):
        self.plan(bonus_percent=Decimal('0'))
        month = self.today.month % 12 + 1
        year = self.today.year + (self.today.month == 12)
        next_plan = MonthlyPlan.objects.create(manager=self.manager, year=year, month=month)
        self.assertEqual(next_plan.bonus_percent, Decimal('3'))


class OctoberBonusRepairTests(TestCase):
    def test_targeted_repair_leaves_history_and_other_staff_unchanged(self):
        kate = User.objects.create_user(username='ekaterina', role=User.Role.MANAGER)
        other = User.objects.create_user(username='other', role=User.Role.MANAGER)
        october = MonthlyPlan.objects.create(manager=kate, year=2026, month=10, bonus_percent=0, base_salary=31000)
        september = MonthlyPlan.objects.create(manager=kate, year=2026, month=9, bonus_percent=1)
        other_plan = MonthlyPlan.objects.create(manager=other, year=2026, month=10, bonus_percent=0)
        restore_october_bonus(apps, SimpleNamespace(connection=connection))
        october.refresh_from_db()
        september.refresh_from_db()
        other_plan.refresh_from_db()
        self.assertEqual(october.bonus_percent, Decimal('3'))
        self.assertEqual(october.base_salary, Decimal('31000'))
        self.assertEqual(september.bonus_percent, Decimal('1'))
        self.assertEqual(other_plan.bonus_percent, Decimal('0'))

    def test_renamed_account_resolved_by_full_name(self):
        kate = User.objects.create_user(username='renamed', first_name='Екатерина', last_name='Макеева', role=User.Role.MANAGER)
        restore_october_bonus(apps, SimpleNamespace(connection=connection))
        plan = MonthlyPlan.objects.get(manager=kate, year=2026, month=10)
        self.assertEqual(plan.bonus_percent, Decimal('3'))

    def test_ambiguous_accounts_do_not_modify_any_salary(self):
        User.objects.create_user(username='ekaterina', role=User.Role.MANAGER)
        User.objects.create_user(username='renamed', first_name='Екатерина', last_name='Макеева', role=User.Role.MANAGER)
        with self.assertRaises(RuntimeError):
            restore_october_bonus(apps, SimpleNamespace(connection=connection))
        self.assertFalse(MonthlyPlan.objects.exists())
