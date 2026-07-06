from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from kanban.models import KanbanColumn, Task
from leads.models import Direction, Lead

from .adapters import MockUonAdapter, RealUonAdapter
from .models import UonClient, UonRequestRecord, UonWebhookLog
from .tasks import (
    pull_uon_reminders_for_lead,
    sync_all_uon_reminders,
    sync_all_uon_requests,
    sync_uon_request,
)

User = get_user_model()


class MockAdapterTests(TestCase):
    def test_list_reminders_empty(self):
        self.assertEqual(MockUonAdapter().list_reminders('61'), [])

    def test_get_request_none(self):
        self.assertIsNone(MockUonAdapter().get_request('61'))


class RealAdapterTests(TestCase):
    @patch('integrations.adapters.requests.get')
    def test_list_reminders_calls_expected_url(self, mock_get):
        mock_get.return_value.json.return_value = {'reminder': [{'id': 148, 'text': 'x'}]}
        mock_get.return_value.raise_for_status = MagicMock()

        adapter = RealUonAdapter(api_key='KEY123', base_url='https://api.u-on.ru')
        result = adapter.list_reminders('61')

        mock_get.assert_called_once_with('https://api.u-on.ru/KEY123/reminder/61.json', timeout=10)
        self.assertEqual(result, [{'id': 148, 'text': 'x'}])

    @patch('integrations.adapters.requests.get')
    def test_get_request_calls_expected_url(self, mock_get):
        mock_get.return_value.json.return_value = {'request': [{'id': 61, 'client_name': 'Алексей'}]}
        mock_get.return_value.raise_for_status = MagicMock()

        adapter = RealUonAdapter(api_key='KEY123', base_url='https://api.u-on.ru')
        result = adapter.get_request('61')

        mock_get.assert_called_once_with('https://api.u-on.ru/KEY123/request/61.json', timeout=10)
        self.assertEqual(result, {'id': 61, 'client_name': 'Алексей'})

    @patch('integrations.adapters.requests.get')
    def test_get_request_returns_none_when_empty(self, mock_get):
        mock_get.return_value.json.return_value = {'request': []}
        mock_get.return_value.raise_for_status = MagicMock()

        adapter = RealUonAdapter(api_key='KEY123', base_url='https://api.u-on.ru')
        self.assertIsNone(adapter.get_request('999'))


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


@patch('integrations.views.sync_all_uon_requests.delay')
@patch('integrations.views.sync_all_uon_reminders.delay')
class UonSyncTriggerViewTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager', password='x', role=User.Role.MANAGER)
        self.head = User.objects.create_user(username='head', password='x', role=User.Role.HEAD)
        self.admin = User.objects.create_superuser(username='admin', password='x', email='a@a.com')

    def test_manager_forbidden(self, mock_reminders, mock_requests):
        self.client.force_login(self.manager)
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 403)
        mock_reminders.assert_not_called()
        mock_requests.assert_not_called()

    def test_head_can_trigger_sync(self, mock_reminders, mock_requests):
        self.client.force_login(self.head)
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 200)
        mock_reminders.assert_called_once()
        mock_requests.assert_called_once()

    def test_admin_can_trigger_sync(self, mock_reminders, mock_requests):
        self.client.force_login(self.admin)
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 200)
        mock_reminders.assert_called_once()

    def test_anonymous_rejected(self, mock_reminders, mock_requests):
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 403)


REAL_REQUEST_PAYLOAD = {
    'id': 61,
    'client_id': 96,
    'client_surname': 'Артамонов',
    'client_name': 'Алексей',
    'client_phone_mobile': '+79273789757',
    'client_email': 'artpnz@mail.ru',
    'status_id': '5',
    'status': 'Документы выданы',
    'manager_name': None,
    'source': None,
    'notes': '',
    'is_archive': 1,
    'dat_request': '2026-06-09 09:50',
}


class SyncUonRequestTests(TestCase):
    @patch('integrations.tasks.get_uon_adapter')
    def test_upserts_request_and_derives_client(self, mock_get_adapter):
        mock_get_adapter.return_value.get_request.return_value = REAL_REQUEST_PAYLOAD

        sync_uon_request('61')

        record = UonRequestRecord.objects.get(uon_id='61')
        self.assertEqual(record.client_name, 'Артамонов Алексей')
        self.assertEqual(record.client_phone, '+79273789757')
        self.assertEqual(record.status_id, '5')
        self.assertEqual(record.status_name, 'Документы выданы')
        self.assertTrue(record.is_archive)
        self.assertIsNotNone(record.uon_created_at)

        client = UonClient.objects.get(uon_id='96')
        self.assertEqual(client.name, 'Артамонов Алексей')
        self.assertEqual(client.phone, '+79273789757')

    @patch('integrations.tasks.get_uon_adapter')
    def test_rerun_updates_without_duplicating(self, mock_get_adapter):
        mock_get_adapter.return_value.get_request.return_value = REAL_REQUEST_PAYLOAD
        sync_uon_request('61')

        updated = dict(REAL_REQUEST_PAYLOAD, status='Оплачено', status_id='6')
        mock_get_adapter.return_value.get_request.return_value = updated
        sync_uon_request('61')

        self.assertEqual(UonRequestRecord.objects.filter(uon_id='61').count(), 1)
        self.assertEqual(UonClient.objects.filter(uon_id='96').count(), 1)
        record = UonRequestRecord.objects.get(uon_id='61')
        self.assertEqual(record.status_name, 'Оплачено')

    @patch('integrations.tasks.get_uon_adapter')
    def test_skips_when_request_not_found(self, mock_get_adapter):
        mock_get_adapter.return_value.get_request.return_value = None
        sync_uon_request('999')
        self.assertEqual(UonRequestRecord.objects.count(), 0)


class SyncAllUonRequestsTests(TestCase):
    @patch('integrations.tasks.sync_uon_request.delay')
    def test_dispatches_for_every_lead_with_uon_ticket(self, mock_delay):
        direction = Direction.objects.create(name='Египет')
        Lead.objects.create(name='С U-ON', direction=direction, uon_ticket_id='61')
        Lead.objects.create(name='Без U-ON', direction=direction, uon_ticket_id='')

        sync_all_uon_requests()

        mock_delay.assert_called_once_with('61')


class UonWebhookViewTests(TestCase):
    @patch('integrations.views.sync_uon_request.delay')
    def test_dispatches_sync_for_request_id(self, mock_delay):
        response = self.client.post(
            '/api/integrations/uon/webhook/',
            data={'type_id': '1', 'request_id': 61, 'uon_id': 62499},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        mock_delay.assert_called_once_with('61')
        self.assertEqual(UonWebhookLog.objects.count(), 1)
        log = UonWebhookLog.objects.first()
        self.assertEqual(log.request_id, '61')
        self.assertEqual(log.type_id, '1')

    @patch('integrations.views.sync_uon_request.delay')
    def test_ignores_payload_without_request_id(self, mock_delay):
        response = self.client.post(
            '/api/integrations/uon/webhook/',
            data={'type_id': '30'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        mock_delay.assert_not_called()
        self.assertEqual(UonWebhookLog.objects.count(), 1)

    @override_settings(UON_WEBHOOK_SECRET='secret123')
    def test_rejects_wrong_token_when_secret_configured(self):
        response = self.client.post(
            '/api/integrations/uon/webhook/?token=wrong',
            data={'type_id': '1', 'request_id': 61},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    @override_settings(UON_WEBHOOK_SECRET='secret123')
    @patch('integrations.views.sync_uon_request.delay')
    def test_accepts_correct_token_when_secret_configured(self, mock_delay):
        response = self.client.post(
            '/api/integrations/uon/webhook/?token=secret123',
            data={'type_id': '1', 'request_id': 61},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        mock_delay.assert_called_once_with('61')


class UonMirrorViewSetTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager', password='x', role=User.Role.MANAGER)
        self.client.force_login(self.manager)

    def test_lists_are_readable_by_any_authenticated_user(self):
        UonRequestRecord.objects.create(uon_id='1', client_name='Заявка')
        UonClient.objects.create(uon_id='3', name='Клиент')

        for path in ('requests', 'clients'):
            response = self.client.get(f'/api/crm/uon/{path}/')
            self.assertEqual(response.status_code, 200, path)

    def test_requests_filterable_by_is_archive(self):
        UonRequestRecord.objects.create(uon_id='1', client_name='Активная', is_archive=False)
        UonRequestRecord.objects.create(uon_id='2', client_name='Архивная', is_archive=True)

        response = self.client.get('/api/crm/uon/requests/?is_archive=1')
        data = response.json()
        items = data if isinstance(data, list) else data['results']
        names = [item['client_name'] for item in items]
        self.assertEqual(names, ['Архивная'])

    def test_write_methods_not_allowed(self):
        response = self.client.post('/api/crm/uon/requests/', {'uon_id': '99', 'client_name': 'x'})
        self.assertEqual(response.status_code, 405)
