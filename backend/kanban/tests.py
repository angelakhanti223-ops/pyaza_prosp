from django.contrib.auth import get_user_model
from django.test import TestCase

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
