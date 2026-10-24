from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from leads.auto_tags import sync_automatic_lead_tags
from leads.dashboard import task_counts_data
from leads.models import Lead
from .models import KanbanColumn, Task
from .push import due_tasks
from .services import column_for_status, reposition_task, task_is_closed


class UnifiedTaskTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='unified-tasks')
        self.other = get_user_model().objects.create_user(username='other-unified')
        self.client.force_login(self.user)
        self.columns = {column.status: column for column in KanbanColumn.objects.filter(is_active=True)}
        self.url = '/api/crm/kanban/tasks/'

    def task(self, **values):
        return Task.objects.create(title='Проверить заявку', column=self.columns['new'], assignee=self.user, **values)

    def update(self, task, **values):
        return self.client.patch(f'{self.url}{task.pk}/', values, content_type='application/json')

    def move(self, task, status, **values):
        return self.client.post(f'{self.url}{task.pk}/move/', {'column': self.columns[status].pk, 'order': 0, **values}, content_type='application/json')

    def assert_consistent(self, task):
        task.refresh_from_db()
        self.assertEqual(task.status, task.column.status)
        self.assertEqual(task.get_status_display(), task.column.name)

    @patch('kanban.views.notify_task_assignment.delay')
    def test_creating_in_each_column_sets_same_status(self, notify):
        response = self.client.get('/api/crm/kanban/columns/')
        self.assertEqual(len(response.json()), 6)
        self.assertEqual({row['status'] for row in response.json()}, set(Task.Status.values))
        for status, column in self.columns.items():
            response = self.client.post(self.url, {'title': status, 'column': column.pk}, content_type='application/json')
            self.assertEqual(response.status_code, 201, response.content)
            self.assertEqual(response.json()['status'], status)
            self.assert_consistent(Task.objects.get(pk=response.json()['id']))

    def test_contradictory_create_is_rejected_and_status_only_create_works(self):
        response = self.client.post(self.url, {'title': 'Ошибка', 'column': self.columns['new'].pk, 'status': 'done'}, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        response = self.client.post(self.url, {'title': 'Без дублирующего поля', 'status': 'waiting_client'}, content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assert_consistent(Task.objects.get(pk=response.json()['id']))

    def test_status_edit_and_drag_share_all_six_transitions(self):
        task = self.task()
        for status in Task.Status.values:
            response = self.update(task, status=status)
            self.assertEqual(response.status_code, 200, response.content)
            self.assert_consistent(task)
        for status in Task.Status.values:
            response = self.move(task, status)
            self.assertEqual(response.status_code, 200, response.content)
            self.assert_consistent(task)

    def test_orm_and_admin_saves_also_keep_column_and_status_together(self):
        task = self.task()
        task.status = 'waiting_client'; task.save(update_fields=['status'])
        self.assert_consistent(task)
        task.column = self.columns['done']; task.save(update_fields=['column'])
        self.assertEqual(task.status, 'done'); self.assert_consistent(task)
        task.status = 'new'; task.save(update_fields=['status'])
        self.assert_consistent(task)

    def test_postponing_from_drag_or_status_moves_deadline_once(self):
        deadline = timezone.now() + timedelta(days=1)
        task = self.task(deadline=deadline)
        self.assertEqual(self.move(task, 'postponed').status_code, 200)
        task.refresh_from_db(); self.assertEqual(task.deadline, deadline + timedelta(days=3))
        self.assertEqual(self.move(task, 'postponed').status_code, 200)
        self.assertEqual(self.update(task, status='postponed').status_code, 200)
        task.refresh_from_db(); self.assertEqual(task.deadline, deadline + timedelta(days=3))

    def test_explicit_postponement_date_is_preserved(self):
        task = self.task(deadline=timezone.now())
        requested = timezone.now() + timedelta(days=12)
        self.assertEqual(self.update(task, status='postponed', deadline=requested.isoformat()).status_code, 200)
        task.refresh_from_db(); self.assertEqual(task.deadline, requested)
        self.assert_consistent(task)

    def test_finished_tasks_are_absent_from_push_counts_and_urgency(self):
        deadline = timezone.now() - timedelta(minutes=1)
        active = self.task(deadline=deadline)
        done = self.task(deadline=deadline); self.update(done, status='done')
        cancelled = self.task(deadline=deadline); self.move(cancelled, 'cancelled')
        self.assertEqual(list(due_tasks(self.user.pk).values_list('pk', flat=True)), [active.pk])
        self.assertEqual(task_counts_data(self.user, True)['overdue'], 1)
        for task in [done, cancelled]:
            task.refresh_from_db(); self.assertTrue(task_is_closed(task)); self.assertIsNone(task.priority)

    def test_column_order_does_not_define_completion(self):
        KanbanColumn.objects.filter(status='new').update(order=99)
        KanbanColumn.objects.filter(status='cancelled').update(order=0)
        task = self.task(deadline=timezone.now() - timedelta(minutes=1))
        self.assertFalse(task_is_closed(task))
        self.assertTrue(due_tasks(self.user.pk).filter(pk=task.pk).exists())
        from telegrambot.services import get_first_column, get_last_column
        self.assertEqual(get_first_column().status, 'new')
        self.assertEqual(get_last_column().status, 'done')

    def test_recurring_task_creates_exactly_one_successor_on_completion(self):
        task = self.task(is_recurring=True, deadline=timezone.now() + timedelta(days=1), preferred_contact_channel='telegram')
        self.assertEqual(self.update(task, status='done').status_code, 200)
        child = Task.objects.get(recurrence_parent=task)
        self.assertEqual(child.status, 'new'); self.assert_consistent(child)
        self.assertEqual(child.preferred_contact_channel, 'telegram')
        self.update(task, status='done')
        self.update(task, status='new'); self.move(task, 'done')
        self.assertEqual(Task.all_objects.filter(recurrence_parent=task).count(), 1)

    def test_cancelled_recurring_task_does_not_repeat(self):
        task = self.task(is_recurring=True)
        self.assertEqual(self.move(task, 'cancelled').status_code, 200)
        self.assertFalse(Task.objects.filter(recurrence_parent=task).exists())

    def test_recurring_task_created_completed_has_one_successor(self):
        task = self.task(is_recurring=True, status='done')
        self.assert_consistent(task)
        child = Task.objects.get(recurrence_parent=task)
        self.assertEqual(child.status, 'new')
        self.assert_consistent(child)
        task.save()
        self.assertEqual(Task.all_objects.filter(recurrence_parent=task).count(), 1)

    def test_archived_successor_does_not_get_recreated(self):
        task = self.task(is_recurring=True)
        self.update(task, status='done')
        Task.objects.filter(recurrence_parent=task).update(archived_at=timezone.now())
        self.update(task, status='new'); self.update(task, status='done')
        self.assertEqual(Task.all_objects.filter(recurrence_parent=task).count(), 1)

    def test_drag_rebuilds_order_despite_archival_and_deletion_gaps(self):
        a, b, c = self.task(), self.task(), self.task()
        Task.objects.filter(pk=a.pk).update(order=10)
        Task.objects.filter(pk=b.pk).update(order=50)
        Task.objects.filter(pk=c.pk).update(order=99)
        reposition_task(c, self.columns['new'], 0)
        rows = list(Task.objects.filter(column=self.columns['new']).order_by('order').values_list('pk', 'order'))
        self.assertEqual(rows, [(c.pk, 0), (a.pk, 1), (b.pk, 2)])
        self.assert_consistent(c)

    def test_stale_edit_and_move_return_conflict_without_overwriting(self):
        task = self.task()
        old = task.updated_at.isoformat()
        self.assertEqual(self.update(task, title='Уже изменена', expected_updated_at=old).status_code, 200)
        self.assertEqual(self.update(task, title='Старая форма', expected_updated_at=old).status_code, 409)
        self.assertEqual(self.move(task, 'done', expected_updated_at=old).status_code, 409)
        task.refresh_from_db(); self.assertEqual(task.title, 'Уже изменена'); self.assertEqual(task.status, 'new')

    def test_invalid_filters_and_retired_columns_are_rejected(self):
        for params in [{'lead': 'bad'}, {'status': 'invalid'}, {'uon_record_id': '1'}]:
            self.assertEqual(self.client.get(self.url, params).status_code, 400)
        retired = KanbanColumn.objects.create(name='Старая', is_active=False)
        task = self.task()
        response = self.client.post(f'{self.url}{task.pk}/move/', {'column': retired.pk, 'order': 0}, content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_related_tasks_are_shared_between_local_and_uon_contexts(self):
        lead = Lead.objects.create(name='Клиент', uon_ticket_id='101', uon_request_id='202')
        local = self.task(lead=lead)
        native = self.task(uon_record_kind='lead', uon_record_id='101')
        native_request = self.task(uon_record_kind='request', uon_record_id='202')
        self.task()
        ids = lambda response: {row['id'] for row in response.json()}
        self.assertEqual(ids(self.client.get(self.url, {'lead': lead.pk})), {local.pk, native.pk, native_request.pk})
        self.assertEqual(ids(self.client.get(self.url, {'uon_record_kind': 'lead', 'uon_record_id': '101'})), {local.pk, native.pk})

    def test_contact_completion_reopen_and_reassignment_update_the_lead(self):
        deadline = timezone.now() - timedelta(minutes=2)
        lead = Lead.objects.create(name='Контакт', next_contact_at=deadline, assigned_manager=self.user)
        sync_automatic_lead_tags(lead)
        self.assertTrue(lead.tags.filter(name='Просрочен контакт').exists())
        task = Task.objects.get(lead=lead, origin='next_contact')
        self.move(task, 'done')
        lead.refresh_from_db(); self.assertIsNone(lead.next_contact_at)
        self.assertFalse(lead.tags.filter(name='Просрочен контакт').exists())
        self.update(task, status='new')
        lead.refresh_from_db(); self.assertEqual(lead.next_contact_at, deadline)
        with patch('kanban.views.notify_task_assignment.delay'):
            self.assertEqual(self.update(task, assignee_id=self.other.pk).status_code, 200)
        lead.refresh_from_db(); self.assertEqual(lead.assigned_manager, self.other)
        self.assert_consistent(task)

    def test_contact_cannot_become_recurring_or_change_its_lead(self):
        lead = Lead.objects.create(name='Контакт', next_contact_at=timezone.now(), assigned_manager=self.user)
        other = Lead.objects.create(name='Другая заявка')
        task = Task.objects.get(lead=lead, origin='next_contact')
        self.assertEqual(self.update(task, is_recurring=True).status_code, 400)
        self.assertEqual(self.update(task, lead=other.pk).status_code, 400)

    def test_closed_lead_contact_cannot_reopen_from_editor_or_drag(self):
        lead = Lead.objects.create(name='Контакт', next_contact_at=timezone.now(), assigned_manager=self.user)
        task = Task.objects.get(lead=lead, origin='next_contact')
        lead.status = Lead.Status.CLOSED_WON
        lead.save()
        self.assertEqual(self.update(task, status='new').status_code, 400)
        self.assertEqual(self.move(task, 'new').status_code, 400)
        self.assert_consistent(task)
        self.assertEqual(task.status, 'cancelled')

    def test_completing_contact_with_edited_deadline_clears_previous_schedule(self):
        deadline = timezone.now()
        lead = Lead.objects.create(name='Контакт', next_contact_at=deadline, assigned_manager=self.user)
        task = Task.objects.get(lead=lead, origin='next_contact')
        self.assertEqual(self.update(task, status='done', deadline=(deadline + timedelta(hours=1)).isoformat()).status_code, 200)
        lead.refresh_from_db()
        self.assertIsNone(lead.next_contact_at)

    def test_archived_tasks_stay_hidden_from_related_views(self):
        lead = Lead.objects.create(name='Архив')
        self.task(lead=lead, archived_at=timezone.now())
        self.assertEqual(self.client.get(self.url, {'lead': lead.pk}).json(), [])
