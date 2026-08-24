from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from integrations.models import UonLeadRecord
from kanban.models import KanbanColumn, Task

from .dashboard import actual_commission_for_month, plan_progress_rows
from .models import Direction, Lead, MonthlyPlan
from .tasks import check_stale_leads, create_new_lead_task

User = get_user_model()


class LeadDetailUonLeadTests(TestCase):
    """Карточка заявки показывает данные обращения из U-ON-зеркала, если оно уже
    синхронизировано — панель добавлена к существующей странице «Заявки», не
    заменяет собой редактирование статуса/менеджера/комментариев (ТЗ по требованию клиента).
    Lead.uon_ticket_id — это ID обращения (lead) в U-ON, не заявки (request) —
    это разные сущности с разными ID в этом API."""

    def setUp(self):
        self.head = User.objects.create_user(username='head', password='x', role=User.Role.HEAD)
        self.direction = Direction.objects.create(name='Турция')
        self.client.force_login(self.head)

    def test_uon_lead_null_without_ticket(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction)
        response = self.client.get(f'/api/crm/leads/{lead.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['uon_lead'])

    def test_uon_lead_null_when_not_yet_synced(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, uon_ticket_id='199')
        response = self.client.get(f'/api/crm/leads/{lead.id}/')
        self.assertIsNone(response.json()['uon_lead'])

    def test_uon_lead_present_when_synced(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, uon_ticket_id='199')
        UonLeadRecord.objects.create(uon_id='199', client_name='Иван Иванов', status_name='В работе')

        response = self.client.get(f'/api/crm/leads/{lead.id}/')

        data = response.json()['uon_lead']
        self.assertIsNotNone(data)
        self.assertEqual(data['status_name'], 'В работе')
        self.assertEqual(data['client_name'], 'Иван Иванов')


class LeadStatusChangeNotificationTests(TestCase):
    """Пуш менеджеру только на ключевые для денег переходы (бронь/оплата/отказ) —
    не на каждую смену статуса, решение заказчика 19.08.2026."""

    def setUp(self):
        self.head = User.objects.create_user(username='head', password='x', role=User.Role.HEAD)
        self.manager = User.objects.create_user(username='manager', password='x', role=User.Role.MANAGER)
        self.direction = Direction.objects.create(name='Турция')
        self.client.force_login(self.head)

    @patch('leads.views.notify_lead_status_change.delay')
    def test_notifies_on_transition_to_booked(self, mock_delay):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.IN_PROGRESS,
        )
        response = self.client.patch(
            f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.BOOKED}, content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        mock_delay.assert_called_once_with(lead.id, Lead.Status.BOOKED)

    @patch('leads.views.notify_lead_status_change.delay')
    def test_notifies_on_transition_to_paid(self, mock_delay):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.BOOKED,
        )
        self.client.patch(f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.PAID}, content_type='application/json')
        mock_delay.assert_called_once_with(lead.id, Lead.Status.PAID)

    @patch('leads.views.notify_lead_status_change.delay')
    def test_notifies_on_transition_to_closed_lost(self, mock_delay):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.IN_PROGRESS,
        )
        self.client.patch(
            f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.CLOSED_LOST}, content_type='application/json',
        )
        mock_delay.assert_called_once_with(lead.id, Lead.Status.CLOSED_LOST)

    @patch('leads.views.notify_lead_status_change.delay')
    def test_does_not_notify_on_routine_transition(self, mock_delay):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.NEW,
        )
        self.client.patch(
            f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.IN_PROGRESS}, content_type='application/json',
        )
        mock_delay.assert_not_called()

    @patch('leads.views.notify_lead_status_change.delay')
    def test_does_not_notify_when_status_unchanged(self, mock_delay):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.BOOKED,
        )
        self.client.patch(
            f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.BOOKED}, content_type='application/json',
        )
        mock_delay.assert_not_called()


class LeadCreateSerializerDispatchesNewLeadTaskTests(TestCase):
    """Публичная форма/чат-бот — единственный путь создания Lead (у LeadViewSet
    нет CreateModelMixin, ручного создания заявки в CRM не существует)."""

    def setUp(self):
        self.direction = Direction.objects.create(name='Испания')

    @patch('integrations.tasks.sync_lead_to_uon.delay')
    @patch('emailing.tasks.send_lead_notification_task.delay')
    @patch('leads.tasks.create_new_lead_task.delay')
    def test_create_dispatches_new_lead_task(self, mock_create_task, *_mocks):
        response = self.client.post('/api/leads/', {
            'name': 'Клиент', 'phone': '+79990000000', 'direction': self.direction.id, 'consent': True,
        })
        self.assertEqual(response.status_code, 201)
        lead_id = response.json()['id']
        mock_create_task.assert_called_once_with(lead_id)


class CreateNewLeadTaskTests(TestCase):
    def setUp(self):
        self.direction = Direction.objects.create(name='Черногория')
        self.column_new = KanbanColumn.objects.get(name='Новая')

    @patch('telegrambot.tasks.notify_task_created.delay')
    def test_creates_unassigned_task_and_notifies(self, mock_notify):
        lead = Lead.objects.create(name='Новый клиент', phone='+79990001122', direction=self.direction)

        create_new_lead_task(lead.id)

        task = Task.objects.get(lead=lead)
        # ФИО клиента — только в description (видно в CRM), не в title (уходит
        # в Telegram целиком, см. telegrambot.services.format_task_line).
        self.assertNotIn('Новый клиент', task.title)
        self.assertIn(str(lead.id), task.title)
        self.assertIsNone(task.assignee)
        self.assertEqual(task.column_id, self.column_new.id)
        self.assertIn('+79990001122', task.description)
        mock_notify.assert_called_once_with(task.id)


class CheckStaleLeadsTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager5', password='x')
        self.direction = Direction.objects.create(name='Абхазия')
        self.column_new = KanbanColumn.objects.get(name='Новая')
        self.column_done = KanbanColumn.objects.get(name='Готово')

    def _make_stale_lead(self, **kwargs):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, **kwargs)
        Lead.objects.filter(pk=lead.pk).update(updated_at=timezone.now() - timedelta(days=3))
        lead.refresh_from_db()
        return lead

    @patch('telegrambot.tasks.notify_task_created.delay')
    def test_creates_task_for_stale_open_lead(self, mock_notify):
        lead = self._make_stale_lead(assigned_manager=self.manager, status=Lead.Status.IN_PROGRESS)

        check_stale_leads()

        task = Task.objects.get(lead=lead)
        self.assertIn('без движения', task.title)
        self.assertNotIn(lead.name, task.title)  # ФИО — только в description, ТЗ 11.5, 152-ФЗ
        self.assertEqual(task.assignee_id, self.manager.id)
        mock_notify.assert_called_once_with(task.id)

    @patch('telegrambot.tasks.notify_task_created.delay')
    def test_skips_recently_updated_lead(self, mock_notify):
        Lead.objects.create(name='Свежий', direction=self.direction, status=Lead.Status.IN_PROGRESS)
        check_stale_leads()
        self.assertEqual(Task.objects.count(), 0)
        mock_notify.assert_not_called()

    @patch('telegrambot.tasks.notify_task_created.delay')
    def test_skips_closed_leads(self, mock_notify):
        self._make_stale_lead(status=Lead.Status.CLOSED_WON)
        self._make_stale_lead(status=Lead.Status.CLOSED_LOST)
        check_stale_leads()
        self.assertEqual(Task.objects.count(), 0)
        mock_notify.assert_not_called()

    @patch('telegrambot.tasks.notify_task_created.delay')
    def test_does_not_duplicate_existing_open_stale_task(self, mock_notify):
        lead = self._make_stale_lead(status=Lead.Status.IN_PROGRESS)
        check_stale_leads()
        mock_notify.reset_mock()

        check_stale_leads()

        self.assertEqual(Task.objects.filter(lead=lead).count(), 1)
        mock_notify.assert_not_called()

    @patch('telegrambot.tasks.notify_task_created.delay')
    def test_recreates_after_previous_stale_task_closed(self, mock_notify):
        lead = self._make_stale_lead(status=Lead.Status.IN_PROGRESS)
        check_stale_leads()
        Task.objects.filter(lead=lead).update(column=self.column_done)

        check_stale_leads()

        self.assertEqual(Task.objects.filter(lead=lead).count(), 2)


class PlanProgressTests(TestCase):
    """План/факт по комиссии засчитывается по дате перехода в «Оплачено»
    (LeadStatusHistory), не по дате создания заявки — решение заказчика."""

    def setUp(self):
        self.head = User.objects.create_user(username='planhead2', password='x', role=User.Role.HEAD)
        self.manager = User.objects.create_user(username='planmanager3', password='x', role=User.Role.MANAGER)
        self.direction = Direction.objects.create(name='Кипр')
        self.client.force_login(self.head)

    def _pay_lead(self, commission, manager=None):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=manager or self.manager,
            status=Lead.Status.BOOKED, commission=commission,
        )
        self.client.patch(f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.PAID}, content_type='application/json')
        return lead

    def test_actual_commission_sums_paid_leads_this_month(self):
        self._pay_lead(30000)
        self._pay_lead(15000)
        today = timezone.now().date()
        total = actual_commission_for_month(self.manager, today.year, today.month)
        self.assertEqual(total, 45000)

    def test_actual_commission_ignores_other_managers(self):
        other = User.objects.create_user(username='other_manager2', password='x')
        self._pay_lead(10000, manager=other)
        today = timezone.now().date()
        total = actual_commission_for_month(self.manager, today.year, today.month)
        self.assertEqual(total, 0)

    def test_plan_progress_rows_computes_percent(self):
        today = timezone.now().date()
        MonthlyPlan.objects.create(manager=self.manager, year=today.year, month=today.month, target_commission=60000)
        self._pay_lead(30000)

        rows = plan_progress_rows(today.year, today.month)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['target'], 60000)
        self.assertEqual(rows[0]['actual'], 30000)
        self.assertEqual(rows[0]['percent'], 50.0)


class PlanViewTests(TestCase):
    def setUp(self):
        self.head = User.objects.create_user(username='planhead3', password='x', role=User.Role.HEAD)
        self.manager1 = User.objects.create_user(username='planmanager4', password='x', role=User.Role.MANAGER)
        self.manager2 = User.objects.create_user(username='planmanager5', password='x', role=User.Role.MANAGER)
        today = timezone.now().date()
        self.year, self.month = today.year, today.month
        MonthlyPlan.objects.create(manager=self.manager1, year=self.year, month=self.month, target_commission=60000)
        MonthlyPlan.objects.create(manager=self.manager2, year=self.year, month=self.month, target_commission=80000)

    def test_head_sees_all_managers(self):
        self.client.force_login(self.head)
        response = self.client.get('/api/crm/plan/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data['rows']), 2)
        self.assertEqual(float(data['target_total']), 140000)

    def test_manager_sees_only_own_row(self):
        self.client.force_login(self.manager1)
        response = self.client.get('/api/crm/plan/')
        data = response.json()
        self.assertEqual(len(data['rows']), 1)
        self.assertEqual(data['rows'][0]['manager_id'], self.manager1.id)
        self.assertEqual(float(data['target_total']), 60000)
