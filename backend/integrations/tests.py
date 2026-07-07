from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from kanban.models import KanbanColumn, Task
from leads.models import Direction, Lead

from .adapters import MockUonAdapter, RealUonAdapter, UonAdapterError, build_ticket_payload
from .models import UonClient, UonLeadRecord, UonRequestRecord, UonWebhookLog
from .tasks import (
    _match_manager_user,
    pull_uon_reminders_for_lead,
    sync_all_uon_leads,
    sync_all_uon_reminders,
    sync_lead_to_uon,
    sync_uon_lead,
    sync_uon_request,
)

User = get_user_model()


class MockAdapterTests(TestCase):
    def test_list_reminders_empty(self):
        self.assertEqual(MockUonAdapter().list_reminders('61'), [])

    def test_get_request_none(self):
        self.assertIsNone(MockUonAdapter().get_request('61'))

    def test_get_lead_none(self):
        self.assertIsNone(MockUonAdapter().get_lead('61'))

    def test_create_ticket_returns_success_shape(self):
        result = MockUonAdapter().create_ticket({'u_name': 'x'})
        self.assertEqual(result['result'], 200)
        self.assertTrue(result['id'].startswith('MOCK-'))


class BuildTicketPayloadTests(TestCase):
    def test_maps_lead_fields_to_confirmed_uon_field_names(self):
        direction = Direction.objects.create(name='Турция')
        lead = Lead.objects.create(
            name='Иван Иванов', phone='+79990000000', email='ivan@example.com',
            initial_comment='Хочу тур', direction=direction,
        )
        payload = build_ticket_payload(lead)
        self.assertEqual(payload['u_name'], 'Иван Иванов')
        self.assertEqual(payload['u_phone'], '+79990000000')
        self.assertEqual(payload['u_email'], 'ivan@example.com')
        self.assertEqual(payload['note'], 'Хочу тур')
        self.assertEqual(payload['source'], lead.get_source_display())


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

    @patch('integrations.adapters.requests.get')
    def test_get_lead_calls_expected_url(self, mock_get):
        mock_get.return_value.json.return_value = {'result': 200, 'lead': [{'id': 199, 'client_name': 'Иван'}]}
        mock_get.return_value.raise_for_status = MagicMock()

        adapter = RealUonAdapter(api_key='KEY123', base_url='https://api.u-on.ru')
        result = adapter.get_lead('199')

        mock_get.assert_called_once_with('https://api.u-on.ru/KEY123/lead/199.json', timeout=10)
        self.assertEqual(result, {'id': 199, 'client_name': 'Иван'})

    @patch('integrations.adapters.requests.get')
    def test_get_lead_returns_none_when_empty(self, mock_get):
        mock_get.return_value.json.return_value = {'result': 404, 'lead': []}
        mock_get.return_value.raise_for_status = MagicMock()

        adapter = RealUonAdapter(api_key='KEY123', base_url='https://api.u-on.ru')
        self.assertIsNone(adapter.get_lead('999'))

    @patch('integrations.adapters.requests.post')
    def test_create_ticket_calls_expected_url_and_body(self, mock_post):
        mock_post.return_value.json.return_value = {'result': 200, 'id': '200', 'comment': 'ok'}
        mock_post.return_value.raise_for_status = MagicMock()

        adapter = RealUonAdapter(api_key='KEY123', base_url='https://api.u-on.ru')
        payload = {'source': 'Сайт', 'u_name': 'Иван', 'u_phone': '+79990000000', 'u_email': '', 'note': ''}
        result = adapter.create_ticket(payload)

        mock_post.assert_called_once_with(
            'https://api.u-on.ru/KEY123/lead/create.json', data=payload, timeout=10,
        )
        self.assertEqual(result['id'], '200')

    @patch('integrations.adapters.requests.post')
    def test_create_ticket_raises_on_non_200_result(self, mock_post):
        mock_post.return_value.json.return_value = {'result': 400, 'comment': 'bad request'}
        mock_post.return_value.raise_for_status = MagicMock()

        adapter = RealUonAdapter(api_key='KEY123', base_url='https://api.u-on.ru')
        with self.assertRaises(UonAdapterError):
            adapter.create_ticket({'u_name': 'Иван'})


class SyncLeadToUonTests(TestCase):
    def setUp(self):
        self.direction = Direction.objects.create(name='Турция')
        self.lead = Lead.objects.create(name='Иван', phone='+79990000000', direction=self.direction)

    @patch('integrations.tasks.get_uon_adapter')
    def test_saves_returned_id_as_uon_ticket_id(self, mock_get_adapter):
        mock_get_adapter.return_value.create_ticket.return_value = {'result': 200, 'id': '200'}

        sync_lead_to_uon(self.lead.id)

        self.lead.refresh_from_db()
        self.assertEqual(self.lead.uon_ticket_id, '200')

    @patch('integrations.tasks.get_uon_adapter')
    def test_failure_raises_and_logs(self, mock_get_adapter):
        mock_get_adapter.return_value.create_ticket.side_effect = UonAdapterError('boom')

        with self.assertRaises(UonAdapterError):
            sync_lead_to_uon(self.lead.id)

        self.lead.refresh_from_db()
        self.assertEqual(self.lead.uon_ticket_id, '')


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


@patch('integrations.views.sync_all_uon_leads.delay')
@patch('integrations.views.sync_all_uon_reminders.delay')
class UonSyncTriggerViewTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager', password='x', role=User.Role.MANAGER)
        self.head = User.objects.create_user(username='head', password='x', role=User.Role.HEAD)
        self.admin = User.objects.create_superuser(username='admin', password='x', email='a@a.com')

    def test_manager_forbidden(self, mock_reminders, mock_leads):
        self.client.force_login(self.manager)
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 403)
        mock_reminders.assert_not_called()
        mock_leads.assert_not_called()

    def test_head_can_trigger_sync(self, mock_reminders, mock_leads):
        self.client.force_login(self.head)
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 200)
        mock_reminders.assert_called_once()
        mock_leads.assert_called_once()

    def test_admin_can_trigger_sync(self, mock_reminders, mock_leads):
        self.client.force_login(self.admin)
        response = self.client.post('/api/crm/integrations/uon-sync/')
        self.assertEqual(response.status_code, 200)
        mock_reminders.assert_called_once()

    def test_anonymous_rejected(self, mock_reminders, mock_leads):
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

    @patch('integrations.tasks.get_uon_adapter')
    def test_syncs_full_client_details_from_tourists(self, mock_get_adapter):
        """Реальная форма данных туриста из tourists[] (заявка #61 из живого API) —
        основной клиент (client_id=96) тоже встречается в tourists[], плюс есть
        сопутствующий турист-ребёнок (id=99). Проверяем, что оба сохраняются с
        полным набором полей, а не только именем/телефоном/email."""
        payload = dict(REAL_REQUEST_PAYLOAD, tourists=[
            {
                'u_id': 96, 'u_surname': 'Артамонов', 'u_name': 'Алексей', 'u_sname': 'Константинович',
                'u_name_en': 'ALEKSEI', 'u_surname_en': 'ARTAMONOV', 'u_phone_mobile': '+79273789757',
                'u_email': 'artpnz@mail.ru', 'u_sex': 1, 'u_birthday': '1983-07-28 00:00',
                'u_passport_number': '5605545162', 'u_passport_taken': 'ОВД Октябрьского района',
                'u_passport_date': '2005-12-14 00:00', 'address': 'г. Пенза, ул. Ульяновская, 16',
                'country': None, 'city': None,
            },
            {
                'u_id': 99, 'u_surname': 'Артамонова', 'u_name': 'Милана', 'u_sname': 'Алексеевна',
                'u_sex': 2, 'u_birthday': '2020-03-14 00:00', 'u_passport_number': '',
                'u_passport_date': '0001-01-01 00:00',
            },
        ])
        mock_get_adapter.return_value.get_request.return_value = payload

        sync_uon_request('61')

        main = UonClient.objects.get(uon_id='96')
        self.assertTrue(main.is_main_contact)
        self.assertEqual(main.surname, 'Артамонов')
        self.assertEqual(main.patronymic, 'Константинович')
        self.assertEqual(main.sex, 'муж')
        self.assertEqual(str(main.birthday), '1983-07-28')
        self.assertEqual(main.passport_number, '5605545162')
        self.assertEqual(main.address, 'г. Пенза, ул. Ульяновская, 16')

        child = UonClient.objects.get(uon_id='99')
        self.assertFalse(child.is_main_contact)
        self.assertEqual(child.sex, 'жен')
        self.assertEqual(str(child.birthday), '2020-03-14')
        self.assertIsNone(child.passport_date)

        self.assertEqual(UonClient.objects.count(), 2)

    @patch('integrations.tasks.get_uon_adapter')
    def test_handles_explicit_json_null_fields(self, mock_get_adapter):
        """Реальный случай из прода: заявка #2 имела client_phone_mobile/client_phone/
        client_email/manager_name/source равными явному JSON null (не отсутствовали
        вовсе) — dict.get(key, '') всё равно возвращает None в этом случае, что
        роняло сохранение в NOT NULL CharField с IntegrityError."""
        payload = {
            'id': 2,
            'client_id': 3,
            'client_surname': None,
            'client_name': None,
            'client_phone_mobile': None,
            'client_phone': None,
            'client_email': None,
            'status_id': None,
            'status': 'Отказ',
            'manager_name': None,
            'source': None,
            'notes': None,
            'is_archive': True,
            'dat_request': None,
        }
        mock_get_adapter.return_value.get_request.return_value = payload

        sync_uon_request('2')

        record = UonRequestRecord.objects.get(uon_id='2')
        self.assertEqual(record.client_phone, '')
        self.assertEqual(record.client_email, '')
        self.assertEqual(record.client_name, '')


REAL_LEAD_PAYLOAD = {
    'id': 199,
    'id_system': 197,
    'client_id': 250,
    'client_surname': '',
    'client_name': 'Тестовая заявка',
    'client_phone_mobile': '+70000000000',
    'client_email': '',
    'status_id': '1',
    'status': 'Новый',
    'manager_name': None,
    'source': 'site_form',
    'notes': '',
    'is_archive': 0,
    'dat_lead': '2026-07-06 20:15',
}


class SyncUonLeadTests(TestCase):
    @patch('integrations.tasks.get_uon_adapter')
    def test_upserts_lead_and_derives_client(self, mock_get_adapter):
        mock_get_adapter.return_value.get_lead.return_value = REAL_LEAD_PAYLOAD

        sync_uon_lead('199')

        record = UonLeadRecord.objects.get(uon_id='199')
        self.assertEqual(record.client_name, 'Тестовая заявка')
        self.assertEqual(record.client_phone, '+70000000000')
        self.assertEqual(record.status_id, '1')
        self.assertEqual(record.status_name, 'Новый')
        self.assertFalse(record.is_archive)
        self.assertIsNotNone(record.uon_created_at)

        client = UonClient.objects.get(uon_id='250')
        self.assertEqual(client.name, 'Тестовая заявка')

    @patch('integrations.tasks.get_uon_adapter')
    def test_rerun_updates_without_duplicating(self, mock_get_adapter):
        mock_get_adapter.return_value.get_lead.return_value = REAL_LEAD_PAYLOAD
        sync_uon_lead('199')

        updated = dict(REAL_LEAD_PAYLOAD, status='В работе', status_id='2')
        mock_get_adapter.return_value.get_lead.return_value = updated
        sync_uon_lead('199')

        self.assertEqual(UonLeadRecord.objects.filter(uon_id='199').count(), 1)
        record = UonLeadRecord.objects.get(uon_id='199')
        self.assertEqual(record.status_name, 'В работе')

    @patch('integrations.tasks.get_uon_adapter')
    def test_skips_when_lead_not_found(self, mock_get_adapter):
        mock_get_adapter.return_value.get_lead.return_value = None
        sync_uon_lead('999')
        self.assertEqual(UonLeadRecord.objects.count(), 0)


class SyncAllUonLeadsTests(TestCase):
    @patch('integrations.tasks.sync_uon_lead.delay')
    def test_dispatches_for_every_lead_with_uon_ticket(self, mock_delay):
        direction = Direction.objects.create(name='Египет')
        Lead.objects.create(name='С U-ON', direction=direction, uon_ticket_id='199')
        Lead.objects.create(name='Без U-ON', direction=direction, uon_ticket_id='')

        sync_all_uon_leads()

        mock_delay.assert_called_once_with('199')


class MatchManagerUserTests(TestCase):
    def setUp(self):
        User.objects.create_user(username='ekaterina', password='x', first_name='Екатерина', last_name='Макеева')
        User.objects.create_user(username='elena', password='x', first_name='Елена', role=User.Role.HEAD)

    def test_matches_by_first_name_case_insensitive(self):
        user = _match_manager_user('екатерина макеева')
        self.assertEqual(user.username, 'ekaterina')

    def test_matches_single_name(self):
        user = _match_manager_user('Елена')
        self.assertEqual(user.username, 'elena')

    def test_no_match_returns_none(self):
        self.assertIsNone(_match_manager_user('Незнакомый Менеджер'))

    def test_empty_returns_none(self):
        self.assertIsNone(_match_manager_user(''))


class SyncTasksFromRemindersTests(TestCase):
    """Задачи по обращениям/заявкам из U-ON: подтягиваются через тот же sync,
    ответственный подбирается по имени менеджера, в тексте всегда номер записи
    и контакты клиента (ТЗ по требованию клиента)."""

    def setUp(self):
        self.ekaterina = User.objects.create_user(
            username='ekaterina', password='x', first_name='Екатерина', last_name='Макеева',
            role=User.Role.MANAGER,
        )
        self.column_new = KanbanColumn.objects.get(name='Новая')

    @patch('integrations.tasks.get_uon_adapter')
    def test_request_sync_creates_task_with_number_and_contact(self, mock_get_adapter):
        mock_get_adapter.return_value.get_request.return_value = dict(
            REAL_REQUEST_PAYLOAD, manager_name='Екатерина Макеева',
        )
        mock_get_adapter.return_value.list_reminders.return_value = [
            {'id': 900, 'text': 'Позвонить клиенту', 'datetime': '2026-07-08 18:29', 'is_done': 0},
        ]

        sync_uon_request('61')

        task = Task.objects.get(uon_reminder_id='900')
        self.assertIn('№61', task.title)
        self.assertIn('Позвонить клиенту', task.title)
        self.assertIn('Заявка №61', task.description)
        self.assertIn('Артамонов Алексей', task.description)
        self.assertIn('+79273789757', task.description)
        self.assertEqual(task.assignee_id, self.ekaterina.id)

    @patch('integrations.tasks.get_uon_adapter')
    def test_lead_sync_creates_task_without_assignee_when_no_manager_match(self, mock_get_adapter):
        mock_get_adapter.return_value.get_lead.return_value = dict(
            REAL_LEAD_PAYLOAD, manager_name='Кто-то Незнакомый',
        )
        mock_get_adapter.return_value.list_reminders.return_value = [
            {'id': 901, 'text': 'Уточнить даты', 'datetime': '2026-07-09 10:00', 'is_done': 0},
        ]

        sync_uon_lead('199')

        task = Task.objects.get(uon_reminder_id='901')
        self.assertIn('№199', task.title)
        self.assertIn('Обращение №199', task.description)
        self.assertIsNone(task.assignee)

    @patch('integrations.tasks.get_uon_adapter')
    def test_rerun_updates_existing_task_without_duplicating(self, mock_get_adapter):
        mock_get_adapter.return_value.get_request.return_value = dict(
            REAL_REQUEST_PAYLOAD, manager_name='Екатерина Макеева',
        )
        mock_get_adapter.return_value.list_reminders.return_value = [
            {'id': 902, 'text': 'Исходный текст', 'datetime': '2026-07-08 18:29', 'is_done': 0},
        ]
        sync_uon_request('61')

        mock_get_adapter.return_value.list_reminders.return_value = [
            {'id': 902, 'text': 'Обновлённый текст', 'datetime': '2026-07-08 18:29', 'is_done': 1},
        ]
        sync_uon_request('61')

        self.assertEqual(Task.objects.filter(uon_reminder_id='902').count(), 1)
        task = Task.objects.get(uon_reminder_id='902')
        self.assertIn('Обновлённый текст', task.title)


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

    @patch('integrations.views.sync_uon_lead.delay')
    def test_dispatches_sync_for_lead_id(self, mock_delay):
        response = self.client.post(
            '/api/integrations/uon/webhook/',
            data={'type_id': '2', 'lead_id': 199},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        mock_delay.assert_called_once_with('199')

    @patch('integrations.views.sync_uon_request.delay')
    @patch('integrations.views.sync_uon_lead.delay')
    def test_ignores_payload_without_ids(self, mock_lead_delay, mock_request_delay):
        response = self.client.post(
            '/api/integrations/uon/webhook/',
            data={'type_id': '30'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        mock_lead_delay.assert_not_called()
        mock_request_delay.assert_not_called()
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
        UonLeadRecord.objects.create(uon_id='2', client_name='Обращение')
        UonClient.objects.create(uon_id='3', name='Клиент')

        for path in ('requests', 'leads', 'clients'):
            response = self.client.get(f'/api/crm/uon/{path}/')
            self.assertEqual(response.status_code, 200, path)

    def test_write_methods_not_allowed(self):
        response = self.client.post('/api/crm/uon/requests/', {'uon_id': '99', 'client_name': 'x'})
        self.assertEqual(response.status_code, 405)
