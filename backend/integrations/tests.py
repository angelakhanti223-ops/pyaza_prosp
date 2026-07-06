from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from kanban.models import KanbanColumn, Task
from leads.models import Direction, Lead

from .adapters import MockUonAdapter, RealUonAdapter
from .tasks import pull_uon_reminders_for_lead, sync_all_uon_reminders

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


class UonSyncTriggerViewTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager', password='x', role=User.Role.MANAGER)
        self.head = User.objects.create_user(username='head', password='x', role=User.Role.HEAD)
        self.admin = User.objects.create_superuser(username='admin', password='x', email='a@a.com')

    @patch('integrations.views.sync_all_uon_reminders.delay')
    def test_manager_forbidden(self, mock_delay):
        self.client.force_login(self.manager)
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 403)
        mock_delay.assert_not_called()

    @patch('integrations.views.sync_all_uon_reminders.delay')
    def test_head_can_trigger_sync(self, mock_delay):
        self.client.force_login(self.head)
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 200)
        mock_delay.assert_called_once()

    @patch('integrations.views.sync_all_uon_reminders.delay')
    def test_admin_can_trigger_sync(self, mock_delay):
        self.client.force_login(self.admin)
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 200)
        mock_delay.assert_called_once()

    def test_anonymous_rejected(self):
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 403)
