from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from integrations.models import UonLeadRecord, UonRequestRecord
from leads.models import Direction, Lead

from .models import KanbanColumn, Task

User = get_user_model()


class TaskVisibilityTests(TestCase):
    """Обращения (задачи из U-ON reminder sync) показываются на доске только пока связанная
    заявка новая/в работе; задачи-заявки (созданные вручную по Lead) — в любом статусе."""

    def setUp(self):
        self.head = User.objects.create_user(username='head', password='x', role=User.Role.HEAD)
        self.column = KanbanColumn.objects.get(name='Новая')
        self.direction = Direction.objects.create(name='Турция')
        self.client.force_login(self.head)

    def _titles(self):
        response = self.client.get('/api/crm/kanban/tasks/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        items = data if isinstance(data, list) else data['results']
        return {item['title'] for item in items}

    def test_appeal_visible_for_new_and_in_progress_lead(self):
        for status in (Lead.Status.NEW, Lead.Status.IN_PROGRESS):
            lead = Lead.objects.create(name='Клиент', direction=self.direction, status=status)
            Task.objects.create(
                title=f'Appeal {status}', column=self.column, lead=lead, uon_reminder_id=f'r-{status}',
            )
        titles = self._titles()
        self.assertIn('Appeal new', titles)
        self.assertIn('Appeal in_progress', titles)

    def test_appeal_hidden_once_lead_progresses_past_in_progress(self):
        advanced_statuses = [
            Lead.Status.OPTIONS_PROPOSED, Lead.Status.BOOKED, Lead.Status.PAID,
            Lead.Status.CLOSED_WON, Lead.Status.CLOSED_LOST,
        ]
        for status in advanced_statuses:
            lead = Lead.objects.create(name='Клиент', direction=self.direction, status=status)
            Task.objects.create(
                title=f'Appeal {status}', column=self.column, lead=lead, uon_reminder_id=f'adv-{status}',
            )
        titles = self._titles()
        for status in advanced_statuses:
            self.assertNotIn(f'Appeal {status}', titles)

    def test_lead_task_visible_regardless_of_lead_status(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, status=Lead.Status.CLOSED_WON)
        Task.objects.create(title='Lead task closed', column=self.column, lead=lead)
        self.assertIn('Lead task closed', self._titles())

    def test_general_task_always_visible(self):
        Task.objects.create(title='General task', column=self.column)
        self.assertIn('General task', self._titles())

    def test_appeal_without_local_lead_always_visible(self):
        """Задачи, подтянутые напрямую по обращениям/заявкам из зеркала U-ON
        (integrations.tasks.sync_uon_request/sync_uon_lead), не привязаны к
        нашему Lead (lead=None) — статус-фильтр к ним неприменим, они не должны
        скрываться (иначе исчезли бы вообще все задачи, подтянутые этим путём)."""
        Task.objects.create(
            title='U-ON task without local lead', column=self.column, uon_reminder_id='no-lead-1',
        )
        self.assertIn('U-ON task without local lead', self._titles())


class TaskStatusFieldsTests(TestCase):
    """Карточка задачи показывает статус связанного обращения/заявки — своего (CRM Lead)
    или из U-ON-зеркала — раз у самой задачи нет отдельного статуса, только колонка."""

    def setUp(self):
        self.head = User.objects.create_user(username='statushead', password='x', role=User.Role.HEAD)
        self.column = KanbanColumn.objects.get(name='Новая')
        self.direction = Direction.objects.create(name='Турция')
        self.client.force_login(self.head)

    def _by_title(self, title):
        response = self.client.get('/api/crm/kanban/tasks/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        items = data if isinstance(data, list) else data['results']
        return next(item for item in items if item['title'] == title)

    def test_lead_status_display_for_task_linked_to_own_lead(self):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, status=Lead.Status.IN_PROGRESS,
        )
        Task.objects.create(title='Своя заявка', column=self.column, lead=lead)

        item = self._by_title('Своя заявка')
        self.assertEqual(item['lead_status_display'], 'В работе')
        self.assertIsNone(item['uon_status_name'])

    def test_uon_status_name_for_request_linked_task(self):
        UonRequestRecord.objects.create(uon_id='61', status_name='Документы выданы')
        Task.objects.create(
            title='Задача по заявке U-ON', column=self.column,
            uon_reminder_id='rem-1', uon_record_kind='request', uon_record_id='61',
        )

        item = self._by_title('Задача по заявке U-ON')
        self.assertEqual(item['uon_status_name'], 'Документы выданы')
        self.assertIsNone(item['lead_status_display'])

    def test_uon_status_name_for_lead_linked_task(self):
        UonLeadRecord.objects.create(uon_id='199', status_name='Новое')
        Task.objects.create(
            title='Задача по обращению U-ON', column=self.column,
            uon_reminder_id='rem-2', uon_record_kind='lead', uon_record_id='199',
        )

        item = self._by_title('Задача по обращению U-ON')
        self.assertEqual(item['uon_status_name'], 'Новое')

    def test_general_task_has_no_status(self):
        Task.objects.create(title='Обычная задача', column=self.column)

        item = self._by_title('Обычная задача')
        self.assertIsNone(item['lead_status_display'])
        self.assertIsNone(item['uon_status_name'])

    def test_uon_status_name_falls_back_to_direct_query_outside_list(self):
        """move-эндпоинт строит TaskSerializer напрямую, без прогретого контекста
        list() — get_uon_status_name должен подстраховаться точечным запросом."""
        UonRequestRecord.objects.create(uon_id='777', status_name='Бронь')
        task = Task.objects.create(
            title='Move me', column=self.column,
            uon_reminder_id='rem-3', uon_record_kind='request', uon_record_id='777',
        )
        other_column = KanbanColumn.objects.exclude(id=self.column.id).first()

        response = self.client.post(
            f'/api/crm/kanban/tasks/{task.id}/move/',
            {'column': other_column.id, 'order': 0},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['uon_status_name'], 'Бронь')


class TaskStatusUpdateTests(TestCase):
    """Свой статус задачи (не колонка, не связанное обращение/заявка) — исполнитель
    проставляет вручную: Новая/В работе/Отложено/Выполнено/Отменено (решение
    заказчика, 01.09.2026). Перевод в «Отложено» отодвигает дедлайн на +3 дня."""

    def setUp(self):
        self.head = User.objects.create_user(username='statusupdatehead', password='x', role=User.Role.HEAD)
        self.column = KanbanColumn.objects.get(name='Новая')
        self.client.force_login(self.head)

    def test_defaults_to_new(self):
        task = Task.objects.create(title='Задача', column=self.column)
        self.assertEqual(task.status, Task.Status.NEW)

    def test_set_status_to_in_progress(self):
        task = Task.objects.create(title='Задача', column=self.column)

        response = self.client.patch(
            f'/api/crm/kanban/tasks/{task.id}/', {'status': 'in_progress'}, content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'in_progress')
        self.assertEqual(response.json()['status_display'], 'В работе')

    def test_postponing_pushes_deadline_three_days_from_existing_deadline(self):
        deadline = timezone.now().replace(microsecond=0)
        task = Task.objects.create(title='Задача', column=self.column, deadline=deadline, status=Task.Status.NEW)

        response = self.client.patch(
            f'/api/crm/kanban/tasks/{task.id}/', {'status': 'postponed'}, content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.POSTPONED)
        self.assertEqual(task.deadline, deadline + timedelta(days=3))

    def test_postponing_without_existing_deadline_bases_on_now(self):
        task = Task.objects.create(title='Задача', column=self.column, deadline=None)
        before = timezone.now()

        response = self.client.patch(
            f'/api/crm/kanban/tasks/{task.id}/', {'status': 'postponed'}, content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertIsNotNone(task.deadline)
        self.assertGreaterEqual(task.deadline, before + timedelta(days=3))

    def test_explicit_deadline_in_same_request_overrides_auto_postpone(self):
        deadline = timezone.now().replace(microsecond=0)
        task = Task.objects.create(title='Задача', column=self.column, deadline=deadline)
        explicit_deadline = deadline + timedelta(days=10)

        response = self.client.patch(
            f'/api/crm/kanban/tasks/{task.id}/',
            {'status': 'postponed', 'deadline': explicit_deadline.isoformat()},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.deadline, explicit_deadline)

    def test_resaving_already_postponed_task_does_not_push_deadline_again(self):
        deadline = timezone.now().replace(microsecond=0)
        task = Task.objects.create(
            title='Задача', column=self.column, deadline=deadline, status=Task.Status.POSTPONED,
        )

        response = self.client.patch(
            f'/api/crm/kanban/tasks/{task.id}/', {'title': 'Задача (правка)'}, content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.deadline, deadline)

    def test_set_status_to_done_and_cancelled(self):
        task = Task.objects.create(title='Задача', column=self.column)

        response = self.client.patch(
            f'/api/crm/kanban/tasks/{task.id}/', {'status': 'done'}, content_type='application/json',
        )
        self.assertEqual(response.json()['status_display'], 'Выполнено')

        response = self.client.patch(
            f'/api/crm/kanban/tasks/{task.id}/', {'status': 'cancelled'}, content_type='application/json',
        )
        self.assertEqual(response.json()['status_display'], 'Отменено')
