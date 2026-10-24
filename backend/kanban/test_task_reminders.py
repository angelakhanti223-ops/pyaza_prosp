import base64
from datetime import timedelta
from unittest.mock import patch

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.test import TestCase, override_settings
from django.utils import timezone
from pywebpush import WebPushException

from leads.models import Lead
from integrations.tasks import _sync_tasks_from_reminders, handle_uon_task_added, pull_uon_reminders_for_lead, sync_all_uon_reminders
from .models import KanbanColumn, Task, TaskAttachment, TaskPushReceipt, WebPushKey, WebPushSubscription
from .push import dispatch_due_pushes, vapid_identity
from .services import reposition_task

User = get_user_model()


class ContactTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='contact-manager')
        self.other = User.objects.create_user(username='other-manager')
        self.first = KanbanColumn.objects.order_by('order').first()
        self.last = KanbanColumn.objects.order_by('-order').first()
        self.when = timezone.now() + timedelta(days=1)
        self.client.force_login(self.user)

    def lead(self, **kwargs):
        return Lead.objects.create(name='Клиент', phone='test', assigned_manager=self.user, **kwargs)

    def test_creating_contact_immediately_creates_one_task_with_assignee(self):
        lead = self.lead(next_contact_at=self.when)
        task = Task.objects.get(origin='next_contact')
        self.assertEqual(task.lead, lead)
        self.assertEqual(task.deadline, self.when)
        self.assertEqual(task.assignee, self.user)
        self.assertEqual(task.column, self.first)

    @patch('telegrambot.tasks.notify_task_created.delay')
    def test_scheduled_contact_does_not_get_a_second_initial_contact_task(self, notify):
        from leads.tasks import create_new_lead_task
        lead = self.lead(next_contact_at=self.when)
        create_new_lead_task(lead.pk)
        self.assertEqual(Task.objects.filter(lead=lead).count(), 1)
        notify.assert_not_called()

    def test_reschedule_and_repeated_save_do_not_duplicate(self):
        lead = self.lead(next_contact_at=self.when)
        task = Task.objects.get(origin='next_contact')
        lead.next_contact_at += timedelta(hours=3)
        lead.save()
        lead.save()
        task.refresh_from_db()
        self.assertEqual(Task.objects.filter(origin='next_contact').count(), 1)
        self.assertEqual(task.deadline, lead.next_contact_at)

    @patch('leads.views.notify_lead_assignment.delay')
    def test_api_next_contact_update_is_synchronous(self, notify):
        lead = self.lead()
        response = self.client.patch(f'/api/crm/leads/{lead.pk}/', {'next_contact_at': self.when.isoformat()}, content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        task = Task.objects.get(origin='next_contact')
        self.assertEqual(task.deadline, self.when)
        self.assertIn(task.pk, [row['id'] for row in response.json()['tasks']])

    def test_manager_and_contact_channel_changes_update_existing_task(self):
        lead = self.lead(next_contact_at=self.when)
        lead.assigned_manager = self.other
        lead.preferred_messenger = 'telegram'
        lead.save()
        task = Task.objects.get(origin='next_contact')
        self.assertEqual(task.assignee, self.other)
        self.assertEqual(task.preferred_contact_channel, 'telegram')

    def test_clear_or_closed_lead_cancels_contact_task_but_preserves_manual(self):
        for status in ['closed_won', 'closed_lost', 'failed', 'not_target']:
            lead = self.lead(next_contact_at=self.when)
            manual = Task.objects.create(title='Ручная', lead=lead, column=self.first)
            lead.status = status
            lead.save()
            self.assertEqual(Task.objects.get(lead=lead, origin='next_contact').status, 'cancelled')
            self.assertEqual(Task.objects.get(pk=manual.pk).status, 'new')
        lead = self.lead(next_contact_at=self.when)
        lead.next_contact_at = None
        lead.save()
        self.assertEqual(Task.objects.get(lead=lead, origin='next_contact').status, 'cancelled')

    def test_completing_task_clears_contact_and_reschedule_reopens_task(self):
        lead = self.lead(next_contact_at=self.when)
        task = Task.objects.get(lead=lead)
        task.status = 'done'; task.save()
        lead.refresh_from_db()
        self.assertIsNone(lead.next_contact_at)
        lead.name = 'Клиент 2'; lead.save()
        self.assertEqual(Task.objects.get(pk=task.pk).status, 'done')
        lead.next_contact_at = self.when + timedelta(days=1); lead.save()
        task.refresh_from_db(); lead.refresh_from_db()
        self.assertEqual(task.status, 'new')
        self.assertEqual(task.deadline, lead.next_contact_at)

    def test_moving_to_done_column_then_setting_new_contact_keeps_new_date(self):
        lead = self.lead(next_contact_at=self.when)
        task = Task.objects.get(lead=lead)
        reposition_task(task, self.last, 0)
        lead.refresh_from_db(); self.assertIsNone(lead.next_contact_at)
        lead.next_contact_at = self.when + timedelta(days=2); lead.save()
        lead.refresh_from_db(); task.refresh_from_db()
        self.assertIsNotNone(lead.next_contact_at)
        self.assertEqual(task.column, self.first)
        self.assertEqual(task.deadline, lead.next_contact_at)

    def test_rescheduling_in_task_keeps_lead_date_in_sync(self):
        lead = self.lead(next_contact_at=self.when)
        task = Task.objects.get(lead=lead)
        task.deadline += timedelta(hours=2); task.save()
        lead.refresh_from_db(); self.assertEqual(lead.next_contact_at, task.deadline)

    def test_setting_same_date_after_completion_reopens_one_task(self):
        lead = self.lead(next_contact_at=self.when)
        task = Task.objects.get(lead=lead)
        task.status = 'done'; task.save()
        lead.refresh_from_db()
        lead.next_contact_at = self.when; lead.save()
        task.refresh_from_db(); lead.refresh_from_db()
        self.assertEqual(task.status, 'new')
        self.assertEqual(task.column, self.first)
        self.assertEqual(task.deadline, self.when)
        self.assertEqual(lead.next_contact_at, self.when)

    def test_old_dates_are_not_backfilled_on_unrelated_updates(self):
        lead = self.lead()
        Lead.objects.filter(pk=lead.pk).update(next_contact_at=self.when)
        lead.refresh_from_db(); lead.name = 'Новое имя'; lead.save()
        self.assertFalse(Task.objects.filter(lead=lead, origin='next_contact').exists())

    def test_explicit_resave_of_existing_date_creates_missing_contact_task(self):
        lead = self.lead()
        Lead.objects.filter(pk=lead.pk).update(next_contact_at=self.when)
        response = self.client.patch(f'/api/crm/leads/{lead.pk}/', {'next_contact_at': self.when.isoformat()}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Task.objects.get(lead=lead).deadline, self.when)

    def test_postponing_contact_task_moves_lead_date(self):
        lead = self.lead(next_contact_at=self.when)
        task = Task.objects.get(lead=lead)
        response = self.client.patch(f'/api/crm/kanban/tasks/{task.pk}/', {'status': 'postponed'}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        lead.refresh_from_db()
        self.assertEqual(lead.next_contact_at, self.when + timedelta(days=3))

    def test_deleting_contact_task_clears_only_matching_schedule(self):
        lead = self.lead(next_contact_at=self.when)
        Task.objects.get(lead=lead).delete()
        lead.refresh_from_db(); self.assertIsNone(lead.next_contact_at)


@override_settings(UON_IMPORT_TASKS=False)
class UonArchiveTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='archive-head', role='head')
        self.client.force_login(self.user)
        self.column = KanbanColumn.objects.first()

    def test_archived_imports_are_hidden_manual_links_survive_and_restore_is_possible(self):
        archived = Task.all_objects.create(title='Импорт', column=self.column, uon_reminder_id='123', archived_at=timezone.now(), origin='uon_import')
        manual = Task.objects.create(title='Ручная UON', column=self.column, uon_record_kind='lead', uon_record_id='123')
        response = self.client.get('/api/crm/kanban/tasks/')
        self.assertEqual([row['id'] for row in response.json()], [manual.pk])
        self.assertEqual(self.client.get(f'/api/crm/kanban/tasks/{archived.pk}/').status_code, 404)
        self.assertEqual(Task.all_objects.count(), 2)
        archived.archived_at = None; archived.save()
        self.assertTrue(Task.objects.filter(pk=archived.pk).exists())

    @patch('integrations.tasks.get_uon_adapter')
    def test_all_scheduled_import_paths_are_noops(self, adapter):
        lead = Lead.objects.create(name='UON', uon_ticket_id='999')
        _sync_tasks_from_reminders('999', 'lead', '', '', '')
        pull_uon_reminders_for_lead(lead.pk)
        sync_all_uon_reminders()
        adapter.assert_not_called()
        self.assertFalse(Task.objects.exists())

    def test_webhook_keeps_lead_import_but_does_not_create_task(self):
        handle_uon_task_added({'request[r_id]': '999', 'reminder_id': '1', 'client[u_name]': 'Имя'})
        self.assertTrue(Lead.objects.filter(uon_ticket_id='999').exists())
        self.assertFalse(Task.objects.exists())


class WebPushTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='push-user', password='x')
        self.other = User.objects.create_user(username='other-push')
        self.client.force_login(self.user)
        key = ec.generate_private_key(ec.SECP256R1()).public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
        encode = lambda value: base64.urlsafe_b64encode(value).decode().rstrip('=')
        self.subscription_data = {'endpoint': 'https://fcm.googleapis.com/fcm/send/test-endpoint', 'keys': {'p256dh': encode(key), 'auth': encode(b'a' * 16)}}
        self.column = KanbanColumn.objects.order_by('order').first()

    def subscribe(self):
        response = self.client.post('/api/crm/task-push/subscription/', self.subscription_data, content_type='application/json')
        self.assertEqual(response.status_code, 204, response.content)
        return WebPushSubscription.objects.get()

    def task(self, **kwargs):
        return Task.objects.create(title='Проверить документы', column=self.column, assignee=self.user, deadline=timezone.now() - timedelta(minutes=1), **kwargs)

    def test_key_is_persistent_private_key_is_never_in_api_response(self):
        first = self.client.get('/api/crm/task-push/config/').json()
        self.assertEqual(first, self.client.get('/api/crm/task-push/config/').json())
        self.assertEqual(WebPushKey.objects.count(), 1)
        self.assertEqual(set(first), {'public_key', 'enabled'})
        from py_vapid import Vapid
        restored = Vapid.from_string(vapid_identity().private_key)
        public = restored.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
        self.assertEqual(base64.urlsafe_b64encode(public).decode().rstrip('='), first['public_key'])

    def test_subscription_is_session_bound_and_idempotent(self):
        sub = self.subscribe(); self.subscribe()
        self.assertEqual(WebPushSubscription.objects.count(), 1)
        self.assertEqual(sub.user, self.user)
        self.assertEqual(sub.session_key, self.client.session.session_key)

    def test_unsafe_hosts_and_invalid_keys_are_rejected(self):
        for endpoint in ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://localhost/x', 'https://fcm.googleapis.com.evil.example/x', 'https://fcm.googleapis.com:444/x']:
            values = {**self.subscription_data, 'endpoint': endpoint}
            self.assertEqual(self.client.post('/api/crm/task-push/subscription/', values, content_type='application/json').status_code, 400)
        values = {**self.subscription_data, 'keys': {'p256dh': 'bad', 'auth': 'bad'}}
        self.assertEqual(self.client.post('/api/crm/task-push/subscription/', values, content_type='application/json').status_code, 400)

    def test_anonymous_requests_cannot_read_or_subscribe(self):
        self.client.logout()
        self.assertEqual(self.client.get('/api/crm/task-push/config/').status_code, 403)
        self.assertEqual(self.client.post('/api/crm/task-push/subscription/', self.subscription_data, content_type='application/json').status_code, 403)

    def test_cookie_auth_requires_csrf_for_subscribing(self):
        from django.test import Client
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        self.assertEqual(client.post('/api/crm/task-push/subscription/', self.subscription_data, content_type='application/json').status_code, 403)

    @patch('kanban.push.send_push')
    def test_due_tasks_are_sent_once_per_device_and_new_deadline_reminds_again(self, send):
        self.subscribe(); task = self.task()
        self.assertEqual(dispatch_due_pushes(), 1)
        self.assertEqual(dispatch_due_pushes(), 0)
        send.assert_called_once()
        self.assertEqual(send.call_args.args[1]['tasks'][0]['id'], task.pk)
        self.assertNotIn('title', send.call_args.args[1]['tasks'][0])
        task.deadline += timedelta(seconds=1); task.save()
        self.assertEqual(dispatch_due_pushes(), 1)

    @patch('kanban.push.send_push')
    def test_completed_archived_unassigned_future_and_other_users_tasks_do_not_push(self, send):
        self.subscribe()
        self.task(status='done'); self.task(status='cancelled'); self.task(archived_at=timezone.now())
        task = self.task(); task.assignee = self.other; task.save()
        task = self.task(); task.assignee = None; task.save()
        task = self.task(); task.deadline = timezone.now() + timedelta(hours=1); task.save()
        task = self.task(); task.column = KanbanColumn.objects.order_by('-order').first(); task.save()
        self.assertEqual(dispatch_due_pushes(), 0); send.assert_not_called()

    @patch('kanban.push.send_push')
    def test_pushes_are_batched_and_isolated_between_users(self, send):
        self.subscribe()
        for _ in range(4): self.task()
        self.assertEqual(dispatch_due_pushes(), 1)
        self.assertEqual(len(send.call_args.args[1]['tasks']), 4)
        self.assertEqual(TaskPushReceipt.objects.filter(sent_at__isnull=False).count(), 4)

    @patch('kanban.push.send_push')
    def test_delivery_retries_without_marking_failure_as_sent(self, send):
        self.subscribe(); self.task(); send.side_effect = WebPushException('offline')
        self.assertEqual(dispatch_due_pushes(), 0)
        receipt = TaskPushReceipt.objects.get()
        self.assertIsNone(receipt.sent_at); self.assertEqual(receipt.attempts, 1)
        self.assertEqual(dispatch_due_pushes(), 0); self.assertEqual(send.call_count, 1)
        TaskPushReceipt.objects.update(retry_at=timezone.now() - timedelta(seconds=1))
        send.side_effect = None
        self.assertEqual(dispatch_due_pushes(), 1)

    @patch('kanban.push.send_push')
    def test_gone_subscription_is_disabled(self, send):
        sub = self.subscribe(); self.task()
        response = type('Gone', (), {'status_code': 410})()
        send.side_effect = WebPushException('gone', response=response)
        dispatch_due_pushes(); sub.refresh_from_db(); self.assertFalse(sub.is_active)

    @patch('kanban.push.send_push')
    def test_logout_and_expired_or_changed_password_sessions_stop_push(self, send):
        sub = self.subscribe(); self.task()
        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 204)
        sub.refresh_from_db(); self.assertFalse(sub.is_active)
        self.assertEqual(dispatch_due_pushes(), 0)
        self.client.force_login(self.user); sub = self.subscribe()
        Session.objects.filter(session_key=sub.session_key).delete()
        self.assertEqual(dispatch_due_pushes(), 0)
        self.client.force_login(self.user); self.subscribe()
        self.user.set_password('changed'); self.user.save()
        self.assertEqual(dispatch_due_pushes(), 0); send.assert_not_called()

    def test_preview_checks_current_assignee_and_task_status(self):
        task = self.task(); other = self.task(); other.assignee = self.other; other.save()
        response = self.client.get('/api/crm/task-push/preview/', {'ids': f'{task.pk},{other.pk}'})
        self.assertEqual([row['id'] for row in response.json()['tasks']], [task.pk])
        task.status = 'done'; task.save()
        self.assertEqual(self.client.get('/api/crm/task-push/preview/', {'ids': str(task.pk)}).json()['tasks'], [])

    @patch('kanban.push_views.send_push')
    def test_test_notification_requires_subscription_and_uses_current_user(self, send):
        self.assertEqual(self.client.post('/api/crm/task-push/test/').status_code, 400)
        self.subscribe(); response = self.client.post('/api/crm/task-push/test/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(send.call_args.args[1], {'user_id': self.user.pk, 'test': True})
