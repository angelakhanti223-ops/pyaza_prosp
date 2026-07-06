from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from kanban.models import KanbanColumn, Task
from leads.models import Direction, Lead

from .adapters import MockUonAdapter, RealUonAdapter
from .models import UonClient, UonDeal, UonRequest
from .tasks import (
    pull_uon_reminders_for_lead,
    sync_all_uon_reminders,
    sync_uon_clients,
    sync_uon_deals,
    sync_uon_requests,
)

User = get_user_model()


class MockAdapterTests(TestCase):
    def test_list_reminders_empty(self):
        self.assertEqual(MockUonAdapter().list_reminders('61'), [])


class RealAdapterTests(TestCase):
    @patch('integrations.adapters.requests.get')
    def test_list_reminders_calls_expected_url(self, mock_get):
        mock_get.return_value.json.return_value = {'reminder': [{'id': 148, 'text': 'x'}]}
        mock_get.return_value.raise_for_status = MagicMock()

        adapter = RealUonAdapter(api_key='KEY123', base_url='https://api.u-on.ru')
        result = adapter.list_reminders('61')

        mock_get.assert_called_once_with('https://api.u-on.ru/KEY123/reminder/61.json', timeout=10)
        self.assertEqual(result, [{'id': 148, 'text': 'x'}])


class PullUonRemindersTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager', password='x')
        self.direction = Direction.objects.create(name='Турция')
        self.lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, uon_ticket_id='61',
        )
        self.column_new = KanbanColumn.objects.get(name='Новая')
        self.column_done = KanbanColumn.objects.get(name='Готово')

    def test_skips_lead_without_uon_ticket(self):
        lead = Lead.objects.create(name='Без U-ON', direction=self.direction)
        with patch('integrations.tasks.get_uon_adapter') as mock_get_adapter:
            pull_uon_reminders_for_lead(lead.id)
            mock_get_adapter.assert_not_called()

    @patch('integrations.tasks.get_uon_adapter')
    def test_creates_task_from_open_reminder(self, mock_get_adapter):
        mock_get_adapter.return_value.list_reminders.return_value = [
            {'id': 148, 'text': 'Позвонить клиенту', 'datetime': '2026-07-08 18:29', 'is_done': 0},
        ]

        pull_uon_reminders_for_lead(self.lead.id)

        task = Task.objects.get(uon_reminder_id='148')
        self.assertEqual(task.title, 'Позвонить клиенту')
        self.assertEqual(task.lead_id, self.lead.id)
        self.assertEqual(task.assignee_id, self.manager.id)
        self.assertEqual(task.column_id, self.column_new.id)
        self.assertIsNotNone(task.deadline)

    @patch('integrations.tasks.get_uon_adapter')
    def test_done_reminder_goes_to_last_column(self, mock_get_adapter):
        mock_get_adapter.return_value.list_reminders.return_value = [
            {'id': 149, 'text': 'Уже сделано', 'datetime': '2026-07-08 18:29', 'is_done': 1},
        ]

        pull_uon_reminders_for_lead(self.lead.id)

        task = Task.objects.get(uon_reminder_id='149')
        self.assertEqual(task.column_id, self.column_done.id)

    @patch('integrations.tasks.get_uon_adapter')
    def test_rerun_updates_without_duplicating(self, mock_get_adapter):
        mock_get_adapter.return_value.list_reminders.return_value = [
            {'id': 150, 'text': 'Исходный текст', 'datetime': '2026-07-08 18:29', 'is_done': 0},
        ]
        pull_uon_reminders_for_lead(self.lead.id)

        mock_get_adapter.return_value.list_reminders.return_value = [
            {'id': 150, 'text': 'Обновлённый текст', 'datetime': '2026-07-08 18:29', 'is_done': 1},
        ]
        pull_uon_reminders_for_lead(self.lead.id)

        self.assertEqual(Task.objects.filter(uon_reminder_id='150').count(), 1)
        task = Task.objects.get(uon_reminder_id='150')
        self.assertEqual(task.title, 'Обновлённый текст')
        self.assertEqual(task.column_id, self.column_done.id)


class SyncAllUonRemindersTests(TestCase):
    @patch('integrations.tasks.pull_uon_reminders_for_lead.delay')
    def test_dispatches_only_leads_with_uon_ticket(self, mock_delay):
        direction = Direction.objects.create(name='Египет')
        with_ticket = Lead.objects.create(name='С U-ON', direction=direction, uon_ticket_id='61')
        Lead.objects.create(name='Без U-ON', direction=direction, uon_ticket_id='')

        sync_all_uon_reminders()

        mock_delay.assert_called_once_with(with_ticket.id)


@patch('integrations.views.sync_uon_clients.delay')
@patch('integrations.views.sync_uon_deals.delay')
@patch('integrations.views.sync_uon_requests.delay')
@patch('integrations.views.sync_all_uon_reminders.delay')
class UonSyncTriggerViewTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager', password='x', role=User.Role.MANAGER)
        self.head = User.objects.create_user(username='head', password='x', role=User.Role.HEAD)
        self.admin = User.objects.create_superuser(username='admin', password='x', email='a@a.com')

    def test_manager_forbidden(self, mock_reminders, mock_requests, mock_deals, mock_clients):
        self.client.force_login(self.manager)
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 403)
        mock_reminders.assert_not_called()
        mock_requests.assert_not_called()
        mock_deals.assert_not_called()
        mock_clients.assert_not_called()

    def test_head_can_trigger_sync(self, mock_reminders, mock_requests, mock_deals, mock_clients):
        self.client.force_login(self.head)
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 200)
        mock_reminders.assert_called_once()
        mock_requests.assert_called_once()
        mock_deals.assert_called_once()
        mock_clients.assert_called_once()

    def test_admin_can_trigger_sync(self, mock_reminders, mock_requests, mock_deals, mock_clients):
        self.client.force_login(self.admin)
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 200)
        mock_reminders.assert_called_once()

    def test_anonymous_rejected(self, mock_reminders, mock_requests, mock_deals, mock_clients):
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 403)


class UonMirrorSyncTasksTests(TestCase):
    @patch('integrations.tasks.get_uon_adapter')
    def test_sync_uon_requests_upserts_by_uon_id(self, mock_get_adapter):
        mock_get_adapter.return_value.list_requests.return_value = [
            {'id': 61, 'name': 'Иван', 'phone': '+79990000000', 'status': 'Новая', 'manager': 'Ольга'},
        ]
        sync_uon_requests()
        record = UonRequest.objects.get(uon_id='61')
        self.assertEqual(record.name, 'Иван')
        self.assertEqual(record.status_name, 'Новая')

        mock_get_adapter.return_value.list_requests.return_value = [
            {'id': 61, 'name': 'Иван', 'phone': '+79990000000', 'status': 'В работе', 'manager': 'Ольга'},
        ]
        sync_uon_requests()
        self.assertEqual(UonRequest.objects.count(), 1)
        record.refresh_from_db()
        self.assertEqual(record.status_name, 'В работе')

    @patch('integrations.tasks.get_uon_adapter')
    def test_sync_uon_deals_upserts_by_uon_id(self, mock_get_adapter):
        mock_get_adapter.return_value.list_deals.return_value = [
            {'id': 900, 'name': 'Сделка', 'amount': '1000.00', 'request_id': 61},
        ]
        sync_uon_deals()
        deal = UonDeal.objects.get(uon_id='900')
        self.assertEqual(deal.request_uon_id, '61')

    @patch('integrations.tasks.get_uon_adapter')
    def test_sync_uon_clients_upserts_by_uon_id(self, mock_get_adapter):
        mock_get_adapter.return_value.list_clients.return_value = [
            {'id': 5, 'name': 'Мария', 'phone': '+79991112233'},
        ]
        sync_uon_clients()
        client = UonClient.objects.get(uon_id='5')
        self.assertEqual(client.phone, '+79991112233')

    @patch('integrations.tasks.get_uon_adapter')
    def test_sync_skips_items_without_id(self, mock_get_adapter):
        mock_get_adapter.return_value.list_clients.return_value = [{'name': 'Без ID'}]
        sync_uon_clients()
        self.assertEqual(UonClient.objects.count(), 0)


class UonMirrorViewSetTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager', password='x', role=User.Role.MANAGER)
        self.client.force_login(self.manager)

    def test_lists_are_readable_by_any_authenticated_user(self):
        UonRequest.objects.create(uon_id='1', name='Заявка')
        UonDeal.objects.create(uon_id='2', name='Сделка')
        UonClient.objects.create(uon_id='3', name='Клиент')

        for path in ('requests', 'deals', 'clients'):
            response = self.client.get(f'/api/crm/uon/{path}/')
            self.assertEqual(response.status_code, 200, path)

    def test_write_methods_not_allowed(self):
        response = self.client.post('/api/crm/uon/requests/', {'uon_id': '99', 'name': 'x'})
        self.assertEqual(response.status_code, 405)
