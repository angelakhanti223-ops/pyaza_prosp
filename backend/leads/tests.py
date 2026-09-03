from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from integrations.models import UonLeadRecord, UonRequestRecord
from kanban.models import KanbanColumn, Task

from .dashboard import _compute, actual_commission_for_month, plan_progress_rows, task_counts_data, work_summary_data
from .models import Direction, Lead, LeadStatusHistory, MonthlyPlan
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


class LeadCrmCreateTests(TestCase):
    """Ручное создание обращения в CRM (со звонка) — второй путь появления
    Lead в системе, наравне с публичной формой (решение заказчика, 27.08.2026)."""

    def setUp(self):
        self.head = User.objects.create_user(username='crmcreatehead', password='x', role=User.Role.HEAD)
        self.manager = User.objects.create_user(username='crmcreatemanager', password='x', role=User.Role.MANAGER)
        self.other_manager = User.objects.create_user(username='crmcreateother', password='x', role=User.Role.MANAGER)
        self.direction = Direction.objects.create(name='Турция')

    @patch('telegrambot.tasks.notify_lead_assignment.delay')
    @patch('leads.tasks.create_new_lead_task.delay')
    @patch('integrations.tasks.sync_lead_to_uon.delay')
    def test_manager_creates_lead_self_assigned_and_synced_to_uon(self, mock_sync, mock_task, mock_notify):
        self.client.force_login(self.manager)

        response = self.client.post('/api/crm/leads/', {
            'name': 'Клиент', 'phone': '+79990000000', 'direction': self.direction.id,
            'initial_comment': 'Звонил, интересует Турция', 'consent': True,
        })

        self.assertEqual(response.status_code, 201)
        data = response.json()
        lead = Lead.objects.get(pk=data['id'])
        self.assertEqual(lead.assigned_manager_id, self.manager.id)
        self.assertEqual(lead.source, Lead.Source.PHONE_CALL)
        self.assertIsNotNone(lead.consent_personal_data_at)
        mock_sync.assert_called_once_with(lead.id)
        mock_task.assert_called_once_with(lead.id)
        mock_notify.assert_called_once_with(lead.id)

    @patch('telegrambot.tasks.notify_lead_assignment.delay')
    @patch('leads.tasks.create_new_lead_task.delay')
    @patch('integrations.tasks.sync_lead_to_uon.delay')
    def test_manager_cannot_assign_lead_to_someone_else(self, mock_sync, mock_task, mock_notify):
        self.client.force_login(self.manager)

        response = self.client.post('/api/crm/leads/', {
            'name': 'Клиент', 'phone': '+79990000000', 'consent': True,
            'assigned_manager': self.other_manager.id,
        })

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Lead.objects.exists())
        mock_sync.assert_not_called()

    @patch('telegrambot.tasks.notify_lead_assignment.delay')
    @patch('leads.tasks.create_new_lead_task.delay')
    @patch('integrations.tasks.sync_lead_to_uon.delay')
    def test_head_can_assign_lead_to_a_manager(self, mock_sync, mock_task, mock_notify):
        self.client.force_login(self.head)

        response = self.client.post('/api/crm/leads/', {
            'name': 'Клиент', 'phone': '+79990000000', 'consent': True,
            'assigned_manager': self.manager.id,
        })

        self.assertEqual(response.status_code, 201)
        lead = Lead.objects.get(pk=response.json()['id'])
        self.assertEqual(lead.assigned_manager_id, self.manager.id)
        mock_notify.assert_called_once_with(lead.id)

    def test_requires_consent(self):
        self.client.force_login(self.manager)

        response = self.client.post('/api/crm/leads/', {
            'name': 'Клиент', 'phone': '+79990000000', 'consent': False,
        })

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Lead.objects.exists())

    def test_requires_authentication(self):
        response = self.client.post('/api/crm/leads/', {
            'name': 'Клиент', 'phone': '+79990000000', 'consent': True,
        })
        self.assertEqual(response.status_code, 403)


class LeadCreateUonRequestTests(TestCase):
    """Перевод обращения в заявку U-ON (POST /request/create.json) — кнопка
    «Создать заявку в U-ON» на карточке обращения (решение заказчика, 31.08.2026)."""

    def setUp(self):
        self.head = User.objects.create_user(username='convrequesthead', password='x', role=User.Role.HEAD)
        self.direction = Direction.objects.create(name='Турция')
        self.client.force_login(self.head)

    @patch('integrations.tasks.sync_uon_request')
    @patch('integrations.adapters.get_uon_adapter')
    def test_creates_uon_request_and_stores_id(self, mock_get_adapter, mock_sync):
        mock_get_adapter.return_value.create_request.return_value = {'result': 200, 'id': '777'}
        lead = Lead.objects.create(name='Клиент', phone='+79990000000', direction=self.direction)

        response = self.client.post(f'/api/crm/leads/{lead.id}/create-uon-request/')

        self.assertEqual(response.status_code, 200)
        lead.refresh_from_db()
        self.assertEqual(lead.uon_request_id, '777')
        self.assertEqual(response.json()['uon_request_id'], '777')
        mock_sync.assert_called_once_with('777')

    def test_already_converted_returns_400(self):
        lead = Lead.objects.create(
            name='Клиент', phone='+79990000000', direction=self.direction, uon_request_id='555',
        )

        response = self.client.post(f'/api/crm/leads/{lead.id}/create-uon-request/')

        self.assertEqual(response.status_code, 400)

    @patch('integrations.adapters.get_uon_adapter')
    def test_adapter_error_returns_502_and_does_not_store_id(self, mock_get_adapter):
        from integrations.adapters import UonAdapterError

        mock_get_adapter.return_value.create_request.side_effect = UonAdapterError('boom')
        lead = Lead.objects.create(name='Клиент', phone='+79990000000', direction=self.direction)

        response = self.client.post(f'/api/crm/leads/{lead.id}/create-uon-request/')

        self.assertEqual(response.status_code, 502)
        lead.refresh_from_db()
        self.assertEqual(lead.uon_request_id, '')

    def test_anonymous_rejected(self):
        self.client.logout()
        lead = Lead.objects.create(name='Клиент', phone='+79990000000', direction=self.direction)

        response = self.client.post(f'/api/crm/leads/{lead.id}/create-uon-request/')

        self.assertEqual(response.status_code, 403)


class LeadFieldEditTests(TestCase):
    """Контактные поля обращения (имя/телефон/email/направление/комментарий)
    редактируются через PATCH — раньше были жёстко зашиты в LeadUpdateSerializer
    как нередактируемые (решение заказчика, 28.08.2026)."""

    def setUp(self):
        self.head = User.objects.create_user(username='editfieldshead', password='x', role=User.Role.HEAD)
        self.manager = User.objects.create_user(username='editfieldsmanager', password='x', role=User.Role.MANAGER)
        self.other_manager = User.objects.create_user(username='editfieldsother', password='x', role=User.Role.MANAGER)
        self.direction = Direction.objects.create(name='Турция')
        self.egypt = Direction.objects.create(name='Египет')

    def test_manager_edits_contact_fields_on_own_lead(self):
        lead = Lead.objects.create(
            name='Старое имя', phone='+79990000000', direction=self.direction, assigned_manager=self.manager,
        )
        self.client.force_login(self.manager)

        response = self.client.patch(
            f'/api/crm/leads/{lead.id}/',
            {'name': 'Новое имя', 'phone': '+79991112233', 'email': 'client@example.com', 'direction': self.egypt.id,
             'initial_comment': 'Уточнённый комментарий'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        lead.refresh_from_db()
        self.assertEqual(lead.name, 'Новое имя')
        self.assertEqual(lead.phone, '+79991112233')
        self.assertEqual(lead.email, 'client@example.com')
        self.assertEqual(lead.direction_id, self.egypt.id)
        self.assertEqual(lead.initial_comment, 'Уточнённый комментарий')

    def test_manager_cannot_edit_someone_elses_lead(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, assigned_manager=self.other_manager)
        self.client.force_login(self.manager)

        response = self.client.patch(
            f'/api/crm/leads/{lead.id}/', {'name': 'Попытка правки'}, content_type='application/json',
        )

        self.assertEqual(response.status_code, 404)  # not in this manager's queryset at all
        lead.refresh_from_db()
        self.assertEqual(lead.name, 'Клиент')

    def test_head_edits_any_lead(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, assigned_manager=self.manager)
        self.client.force_login(self.head)

        response = self.client.patch(
            f'/api/crm/leads/{lead.id}/', {'phone': '+79995556677'}, content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        lead.refresh_from_db()
        self.assertEqual(lead.phone, '+79995556677')


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
    def test_notifies_on_transition_to_closed_won(self, mock_delay):
        # Добавлено 26.08.2026 — это и есть реальный момент получения денег
        # в рабочем процессе команды, а не PAID.
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.BOOKED,
        )
        self.client.patch(
            f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.CLOSED_WON}, content_type='application/json',
        )
        mock_delay.assert_called_once_with(lead.id, Lead.Status.CLOSED_WON)

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
        self.assertNotIn(lead.name, task.title)  # title — стабильный ключ идемпотентности, без ФИО
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
        # «Закрыта (успех)», не «Оплачено» — реальный момент получения денег
        # в рабочем процессе этой команды (решение заказчика, 26.08.2026).
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=manager or self.manager,
            status=Lead.Status.BOOKED, commission=commission,
        )
        self.client.patch(f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.CLOSED_WON}, content_type='application/json')
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

    def test_salary_is_base_plus_own_commission_plus_bonus_from_others(self):
        # 25.08.2026: оклад 30000 + 15% своей комиссии + bonus_percent % от
        # суммарной комиссии остальных держателей плана в этом месяце.
        other = User.objects.create_user(username='other_manager3', password='x')
        today = timezone.now().date()
        MonthlyPlan.objects.create(
            manager=self.manager, year=today.year, month=today.month, target_commission=60000,
            base_salary=30000, commission_percent=15, bonus_percent=3,
        )
        MonthlyPlan.objects.create(
            manager=other, year=today.year, month=today.month, target_commission=60000,
        )
        self._pay_lead(40000)
        self._pay_lead(10000, manager=other)

        rows = plan_progress_rows(today.year, today.month, managers=[self.manager])

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['actual'], 40000)
        self.assertEqual(rows[0]['salary'], 30000 + Decimal('0.15') * 40000 + Decimal('0.03') * 10000)

    def test_salary_defaults_with_no_bonus(self):
        today = timezone.now().date()
        MonthlyPlan.objects.create(manager=self.manager, year=today.year, month=today.month, target_commission=60000)
        self._pay_lead(20000)

        rows = plan_progress_rows(today.year, today.month)

        self.assertEqual(rows[0]['salary'], 30000 + Decimal('0.15') * 20000)


class DashboardCommissionTests(TestCase):
    """Комиссия/сумма сделок считаются по статусу «Закрыта (успех)», не
    «Оплачено» — этот шаг в рабочем процессе команды почти не используется
    (решение заказчика, 26.08.2026)."""

    def setUp(self):
        self.head = User.objects.create_user(username='dashcommhead', password='x', role=User.Role.HEAD)
        self.manager = User.objects.create_user(username='dashcommmanager', password='x', role=User.Role.MANAGER)
        self.direction = Direction.objects.create(name='ОАЭ')

    def _close_won(self, **kwargs):
        """Создаёт заявку сразу в CLOSED_WON + соответствующую запись
        LeadStatusHistory — с 02.09.2026 денежные показатели дашборда считаются
        по дате смены статуса (см. _closed_won_qs), не по дате создания заявки,
        так что без этой записи заявка не попала бы в комиссию за период."""
        lead = Lead.objects.create(status=Lead.Status.CLOSED_WON, **kwargs)
        LeadStatusHistory.objects.create(lead=lead, old_status=Lead.Status.NEW, new_status=Lead.Status.CLOSED_WON)
        return lead

    def test_compute_counts_closed_won_not_paid(self):
        self._close_won(
            name='Успех', direction=self.direction, assigned_manager=self.manager,
            commission=15000, deal_amount=100000,
        )
        Lead.objects.create(
            name='Оплачено-но-не-закрыта', direction=self.direction, assigned_manager=self.manager,
            status=Lead.Status.PAID, commission=99999, deal_amount=999999,
        )

        data = _compute(Lead.objects.all(), timezone.now() - timedelta(days=1), timezone.now() + timedelta(days=1))

        self.assertEqual(data['commission_total'], 15000)
        self.assertEqual(data['deal_amount_total'], 100000)

    def test_commission_by_manager_endpoint_uses_closed_won(self):
        self._close_won(
            name='Успех', direction=self.direction, assigned_manager=self.manager, commission=15000,
        )
        Lead.objects.create(
            name='Просто оплачена', direction=self.direction, assigned_manager=self.manager,
            status=Lead.Status.PAID, commission=99999,
        )
        self.client.force_login(self.head)

        response = self.client.get('/api/crm/dashboard/')

        self.assertEqual(response.status_code, 200)
        by_manager = response.json()['commission_by_manager']
        self.assertEqual(len(by_manager), 1)
        self.assertEqual(float(by_manager[0]['commission']), 15000)
        self.assertEqual(by_manager[0]['deals'], 1)

    def test_deal_stats_and_direction_breakdown(self):
        turkey = Direction.objects.create(name='Турция')
        self._close_won(name='А', direction=turkey, commission=10000, deal_amount=100000)
        self._close_won(name='Б', direction=turkey, commission=20000, deal_amount=200000)
        self._close_won(name='В', direction=self.direction, commission=30000, deal_amount=300000)
        Lead.objects.create(name='Г', direction=self.direction, status=Lead.Status.NEW)  # не должна попасть

        data = _compute(Lead.objects.all(), timezone.now() - timedelta(days=1), timezone.now() + timedelta(days=1))

        self.assertEqual(data['deals_count'], 3)
        self.assertEqual(data['avg_deal_amount'], 200000)
        self.assertEqual(data['avg_commission'], 20000)
        by_direction = {row['direction']: row['count'] for row in data['by_direction']}
        self.assertEqual(by_direction, {'Турция': 2, 'ОАЭ': 1})

    def test_commission_counted_by_close_date_not_creation_date(self):
        """Заявка, заведённая задолго до периода, но закрытая внутри него,
        обязана попасть в комиссию за период — это и была исходная проблема:
        раньше _compute фильтровал по created_at, и такая сделка не
        учитывалась, хотя деньги реально пришли в этом периоде."""
        old_lead = Lead.objects.create(
            name='Старая заявка, закрыта сейчас', direction=self.direction,
            assigned_manager=self.manager, status=Lead.Status.CLOSED_WON, commission=20000,
        )
        Lead.objects.filter(pk=old_lead.pk).update(created_at=timezone.now() - timedelta(days=90))
        LeadStatusHistory.objects.create(lead=old_lead, new_status=Lead.Status.CLOSED_WON)

        data = _compute(Lead.objects.all(), timezone.now() - timedelta(days=1), timezone.now() + timedelta(days=1))

        self.assertEqual(data['commission_total'], 20000)
        self.assertEqual(data['deals_count'], 1)

    def test_commission_excludes_deal_closed_outside_period(self):
        """Обратный случай: заявка закрыта ДО начала периода — не должна
        учитываться в комиссии этого периода, даже если она всё ещё CLOSED_WON."""
        lead = self._close_won(name='Закрыта давно', direction=self.direction, commission=99999)
        LeadStatusHistory.objects.filter(lead=lead).update(changed_at=timezone.now() - timedelta(days=90))

        data = _compute(Lead.objects.all(), timezone.now() - timedelta(days=1), timezone.now() + timedelta(days=1))

        self.assertEqual(data['commission_total'], 0)
        self.assertEqual(data['deals_count'], 0)

    def test_commission_falls_back_to_updated_at_without_status_history(self):
        """Заявка, закрытая в обход CRM (например, правкой в Django admin —
        LeadStatusHistory там не создаётся, только в LeadViewSet.partial_update),
        всё равно должна попасть в комиссию месяца — по updated_at."""
        Lead.objects.create(
            name='Закрыта в обход CRM', direction=self.direction, assigned_manager=self.manager,
            status=Lead.Status.CLOSED_WON, commission=25000,
        )
        # Никакой LeadStatusHistory не создаём — имитируем правку в обход CRM.

        data = _compute(Lead.objects.all(), timezone.now() - timedelta(days=1), timezone.now() + timedelta(days=1))

        self.assertEqual(data['commission_total'], 25000)
        self.assertEqual(data['deals_count'], 1)

    def test_history_takes_priority_over_updated_at_fallback_no_double_count(self):
        """Заявка с реальной записью истории не должна учитываться дважды
        (один раз по истории, один раз по фолбэку на updated_at)."""
        lead = self._close_won(name='Через CRM', direction=self.direction, commission=10000)
        # updated_at этой заявки тоже попадает в период (она только что создана) —
        # фолбэк не должен добавить её в выборку повторно.

        data = _compute(Lead.objects.all(), timezone.now() - timedelta(days=1), timezone.now() + timedelta(days=1))

        self.assertEqual(data['commission_total'], 10000)
        self.assertEqual(data['deals_count'], 1)


class DashboardPeriodViewTests(TestCase):
    """Дашборд теперь выбирает ровно между двумя календарными месяцами —
    текущим и прошлым — вместо плавающего окна 7/30/90 дней (решение
    заказчика, 02.09.2026): не совпадало с логикой плана и путало, когда
    заявка была заведена раньше окна, но закрыта внутри него."""

    def setUp(self):
        self.head = User.objects.create_user(username='dashperiodhead', password='x', role=User.Role.HEAD)
        self.direction = Direction.objects.create(name='Египет')
        self.client.force_login(self.head)

    def test_current_month_is_default(self):
        response = self.client.get('/api/crm/dashboard/')
        self.assertEqual(response.status_code, 200)
        today = timezone.localdate()
        self.assertEqual(response.json()['period']['month'], today.month)
        self.assertEqual(response.json()['period']['year'], today.year)

    def test_last_month_shifts_correctly_including_year_boundary(self):
        response = self.client.get('/api/crm/dashboard/?period=last_month')
        self.assertEqual(response.status_code, 200)
        today = timezone.localdate()
        expected_year, expected_month = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
        self.assertEqual(response.json()['period']['month'], expected_month)
        self.assertEqual(response.json()['period']['year'], expected_year)

    def test_deal_closed_last_month_not_counted_in_current_month(self):
        from .dashboard import month_bounds

        today = timezone.localdate()
        last_year, last_month = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
        last_month_mid, _ = month_bounds(last_year, last_month)
        last_month_mid = last_month_mid + timedelta(days=10)

        lead = Lead.objects.create(
            name='Закрыта в прошлом месяце', direction=self.direction,
            status=Lead.Status.CLOSED_WON, commission=15000,
        )
        history = LeadStatusHistory.objects.create(lead=lead, new_status=Lead.Status.CLOSED_WON)
        LeadStatusHistory.objects.filter(pk=history.pk).update(changed_at=last_month_mid)

        current = self.client.get('/api/crm/dashboard/').json()
        last = self.client.get('/api/crm/dashboard/?period=last_month').json()

        self.assertEqual(current['commission_total'], 0)
        self.assertEqual(last['commission_total'], 15000)


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


class WorkSummaryTests(TestCase):
    """«В работе» = не финальные статусы Lead + не архивные UonRequestRecord —
    решение заказчика 24.08.2026 (у заявки нет отдельного поля «завершена»)."""

    def setUp(self):
        self.head = User.objects.create_user(username='summaryhead', password='x', role=User.Role.HEAD)
        self.manager = User.objects.create_user(
            username='summarymanager', password='x', role=User.Role.MANAGER, first_name='Екатерина',
        )
        self.direction = Direction.objects.create(name='Турция')

    def test_counts_open_leads_only(self):
        Lead.objects.create(name='В работе', direction=self.direction, status=Lead.Status.IN_PROGRESS)
        Lead.objects.create(name='Оплачено', direction=self.direction, status=Lead.Status.PAID)
        Lead.objects.create(name='Успех', direction=self.direction, status=Lead.Status.CLOSED_WON)
        Lead.objects.create(name='Отказ', direction=self.direction, status=Lead.Status.CLOSED_LOST)

        data = work_summary_data(self.head, head=True)

        self.assertEqual(data['leads_total'], 2)
        counts = {row['status']: row['count'] for row in data['leads_by_status']}
        self.assertEqual(counts[Lead.Status.IN_PROGRESS], 1)
        self.assertEqual(counts[Lead.Status.PAID], 1)
        self.assertNotIn(Lead.Status.CLOSED_WON, counts)

    def test_counts_non_archived_requests_only(self):
        UonRequestRecord.objects.create(uon_id='1', status_name='Бронь', is_archive=False)
        UonRequestRecord.objects.create(uon_id='2', status_name='Бронь', is_archive=False)
        UonRequestRecord.objects.create(uon_id='3', status_name='Завершена', is_archive=True)

        data = work_summary_data(self.head, head=True)

        self.assertEqual(data['requests_total'], 2)
        self.assertEqual(data['requests_by_status'], [{'status_name': 'Бронь', 'count': 2}])

    def test_manager_sees_only_own_leads_and_requests(self):
        other = User.objects.create_user(username='summaryother', password='x', first_name='Роман')
        Lead.objects.create(
            name='Мой', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.NEW,
        )
        Lead.objects.create(
            name='Чужой', direction=self.direction, assigned_manager=other, status=Lead.Status.NEW,
        )
        UonRequestRecord.objects.create(uon_id='1', status_name='Бронь', manager_name='Екатерина Макеева', is_archive=False)
        UonRequestRecord.objects.create(uon_id='2', status_name='Бронь', manager_name='Роман Петров', is_archive=False)

        data = work_summary_data(self.manager, head=False)

        self.assertEqual(data['leads_total'], 1)
        self.assertEqual(data['requests_total'], 1)

    def test_head_sees_everything(self):
        Lead.objects.create(name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.NEW)
        UonRequestRecord.objects.create(uon_id='1', status_name='Бронь', manager_name='Кто-то', is_archive=False)

        data = work_summary_data(self.head, head=True)

        self.assertEqual(data['leads_total'], 1)
        self.assertEqual(data['requests_total'], 1)

    def test_includes_task_counts(self):
        data = work_summary_data(self.head, head=True)
        self.assertIn('tasks', data)
        self.assertIn('today', data['tasks'])
        self.assertIn('overdue', data['tasks'])


class TaskCountsTests(TestCase):
    def setUp(self):
        self.head = User.objects.create_user(username='taskcounthead', password='x', role=User.Role.HEAD)
        self.manager = User.objects.create_user(username='taskcountmanager', password='x', role=User.Role.MANAGER)
        self.other = User.objects.create_user(username='taskcountother', password='x', role=User.Role.MANAGER)
        self.column_new = KanbanColumn.objects.get(name='Новая')
        self.column_done = KanbanColumn.objects.get(name='Готово')

    def _task(self, assignee, deadline, column=None):
        return Task.objects.create(
            title='Задача', column=column or self.column_new, assignee=assignee, deadline=deadline,
        )

    def test_counts_today_and_overdue_excluding_done_column(self):
        now = timezone.now()
        self._task(self.manager, now)  # сегодня
        self._task(self.manager, now - timedelta(days=2))  # просрочено
        self._task(self.manager, now + timedelta(days=3))  # будущее — не считается
        self._task(self.manager, now - timedelta(days=1), column=self.column_done)  # готово — не считается

        data = task_counts_data(self.manager, head=False)

        self.assertEqual(data['today'], 1)
        self.assertEqual(data['overdue'], 1)

    def test_manager_sees_only_own_tasks(self):
        now = timezone.now()
        self._task(self.manager, now)
        self._task(self.other, now)

        data = task_counts_data(self.manager, head=False)

        self.assertEqual(data['today'], 1)

    def test_head_sees_all_tasks(self):
        now = timezone.now()
        self._task(self.manager, now)
        self._task(self.other, now)

        data = task_counts_data(self.head, head=True)

        self.assertEqual(data['today'], 2)


class WorkSummaryViewTests(TestCase):
    def setUp(self):
        self.head = User.objects.create_user(username='summaryviewhead', password='x', role=User.Role.HEAD)
        self.direction = Direction.objects.create(name='Кипр')

    def test_endpoint_returns_summary(self):
        Lead.objects.create(name='Клиент', direction=self.direction, status=Lead.Status.NEW)
        self.client.force_login(self.head)

        response = self.client.get('/api/crm/summary/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['leads_total'], 1)
