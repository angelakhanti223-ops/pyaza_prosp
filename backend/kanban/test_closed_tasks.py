from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from integrations.models import UonRequestRecord
from integrations.tasks import check_document_issuance_deadlines
from leads.models import Lead
from leads.tasks import create_new_lead_task, check_stale_leads
from .deals import after_six_months
from .models import Task
from .services import column_for_status


class ClosedTaskTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='closed-tasks')
        self.client.force_login(self.user)
        self.column = column_for_status('new')
        self.url = '/api/crm/kanban/tasks/'

    def task(self, **kwargs):
        return Task.objects.create(title=kwargs.pop('title', 'Проверить заявку'), column=self.column, assignee=self.user, **kwargs)

    def win(self, lead):
        lead.status = Lead.Status.CLOSED_WON
        lead.save()

    def test_success_closes_related_work_but_preserves_explicit_exceptions_and_archive(self):
        lead = Lead.objects.create(name='Клиент', assigned_manager=self.user, uon_request_id='900', uon_ticket_id='901', next_contact_at=timezone.now())
        ordinary = self.task(lead=lead, is_recurring=True)
        request_task = self.task(uon_record_kind='request', uon_record_id='900')
        appeal_task = self.task(uon_record_kind='lead', uon_record_id='901')
        documents = self.task(lead=lead, purpose=Task.Purpose.DOCUMENTS, title='Переименована')
        follow_up = self.task(lead=lead, purpose=Task.Purpose.FOLLOW_UP_6M)
        archived = self.task(lead=lead, archived_at=timezone.now())
        unrelated = self.task()
        self.win(lead)
        for task in [ordinary, request_task, appeal_task, Task.objects.get(lead=lead, origin='next_contact')]:
            task.refresh_from_db()
            self.assertEqual(task.status, 'done')
            self.assertEqual(task.column.status, 'done')
            self.assertEqual(task.closure_reason, 'deal_won')
            self.assertIsNotNone(task.closed_at)
        for task in [documents, follow_up, archived, unrelated]:
            task.refresh_from_db(); self.assertEqual(task.status, 'new')
        self.assertFalse(Task.objects.filter(recurrence_parent=ordinary).exists())
        self.assertEqual(Task.objects.filter(lead=lead, purpose='follow_up_6m').count(), 1)
        lead.refresh_from_db(); self.assertIsNone(lead.next_contact_at)

    def test_one_followup_uses_return_date_and_clamps_calendar_months(self):
        UonRequestRecord.objects.create(uon_id='902', date_end=date(2026, 8, 31))
        lead = Lead.objects.create(name='Клиент', assigned_manager=self.user, uon_request_id='902')
        self.win(lead)
        task = Task.objects.get(origin='after_sale')
        self.assertEqual(timezone.localtime(task.deadline).date(), date(2027, 2, 28))
        self.assertEqual(timezone.localtime(task.deadline).hour, 10)
        self.assertEqual(task.assignee, self.user)
        self.assertEqual(task.status, 'postponed')
        self.assertEqual(task.purpose, 'follow_up_6m')
        self.assertFalse(task.is_recurring)
        self.assertEqual(task.priority, 'important')
        lead.name = 'Исправленное имя'; lead.save()
        lead.status = 'in_progress'; lead.save(); self.win(lead)
        self.assertEqual(Task.all_objects.filter(origin='after_sale').count(), 1)

    def test_followup_without_return_uses_closing_day(self):
        lead = Lead.objects.create(name='Клиент')
        self.win(lead)
        task = Task.objects.get(origin='after_sale')
        self.assertEqual(timezone.localtime(task.deadline).date(), after_six_months(timezone.localdate()))

    def test_followup_can_use_local_tour_dates(self):
        lead = Lead.objects.create(name='Клиент', departure_date=date(2026, 10, 25), nights=7)
        self.win(lead)
        self.assertEqual(timezone.localtime(Task.objects.get(origin='after_sale').deadline).date(), date(2027, 5, 1))

    def test_completed_and_archived_followup_is_not_recreated(self):
        lead = Lead.objects.create(name='Клиент')
        self.win(lead)
        task = Task.objects.get(origin='after_sale')
        task.status = 'done'; task.archived_at = timezone.now(); task.save()
        lead.status = 'in_progress'; lead.save(); self.win(lead)
        self.assertEqual(Task.all_objects.filter(origin='after_sale').count(), 1)

    def test_manual_followup_is_adopted_and_stays_unique_after_archival(self):
        lead = Lead.objects.create(name='Клиент')
        task = self.task(lead=lead, purpose='follow_up_6m', deadline=timezone.now() + timedelta(days=180))
        deadline = task.deadline
        self.win(lead)
        task.refresh_from_db()
        self.assertTrue(task.automation_key); self.assertEqual(task.deadline, deadline)
        task.archived_at = timezone.now(); task.save()
        lead.status = 'in_progress'; lead.save(); self.win(lead)
        self.assertEqual(Task.all_objects.filter(purpose='follow_up_6m').count(), 1)

    def test_uon_transition_closes_native_and_local_tasks_without_duplicate_contact(self):
        record = UonRequestRecord.objects.create(uon_id='903', status_name='Оплачено')
        lead = Lead.objects.create(name='Клиент', uon_request_id='903', assigned_manager=self.user)
        local, native = self.task(lead=lead), self.task(uon_record_kind='request', uon_record_id='903')
        record.status_name = 'Успешная'; record.save()
        for task in [local, native]:
            task.refresh_from_db(); self.assertEqual(task.status, 'done')
        self.win(lead)
        self.assertEqual(Task.objects.filter(purpose='follow_up_6m').count(), 1)

    def test_native_success_without_local_lead_has_linked_followup(self):
        record = UonRequestRecord.objects.create(uon_id='904', status_name='Бронь')
        task = self.task(uon_record_kind='request', uon_record_id='904')
        record.status_name = 'Успешная'; record.save()
        task.refresh_from_db(); self.assertEqual(task.status, 'done')
        followup = Task.objects.get(origin='after_sale')
        self.assertEqual(followup.uon_record_id, '904')
        self.assertIsNone(followup.lead_id)

    def test_initial_import_of_old_success_creates_no_historical_contact(self):
        self.task(uon_record_kind='request', uon_record_id='905')
        UonRequestRecord.objects.create(uon_id='905', status_name='Успешная')
        self.assertEqual(Task.objects.get(uon_record_id='905').status, 'done')
        self.assertFalse(Task.objects.filter(origin='after_sale').exists())

    def test_unsuccessful_archive_and_unknown_uon_stages_do_not_close_work(self):
        record = UonRequestRecord.objects.create(uon_id='906')
        task = self.task(uon_record_kind='request', uon_record_id='906')
        for status in ['Неуспешная', 'Нецелевой', 'Завершена']:
            record.status_name = status; record.is_archive = True; record.save()
        task.refresh_from_db(); self.assertEqual(task.status, 'new')
        self.assertFalse(Task.objects.filter(origin='after_sale').exists())

    def test_failure_rolls_back_deal_and_all_tasks(self):
        lead = Lead.objects.create(name='Клиент')
        task = self.task(lead=lead)
        with patch('kanban.deals._ensure_follow_up', side_effect=RuntimeError('test rollback')):
            with self.assertRaises(RuntimeError):
                self.win(lead)
        lead.refresh_from_db(); task.refresh_from_db()
        self.assertEqual(lead.status, 'new'); self.assertEqual(task.status, 'new')

    def test_manual_closure_records_date_and_reopening_clears_it(self):
        task = self.task()
        task.status = 'cancelled'; task.save()
        at = task.closed_at
        self.assertIsNotNone(at); self.assertEqual(task.closure_reason, 'manual')
        task.title = 'Другое имя'; task.save()
        self.assertEqual(task.closed_at, at)
        task.status = 'new'; task.save()
        self.assertIsNone(task.closed_at); self.assertEqual(task.closure_reason, '')

    def test_open_closed_filters_are_disjoint_and_type_filter_is_validated(self):
        active = self.task(purpose='documents')
        done = self.task(status='done')
        cancelled = self.task(status='cancelled')
        self.task(status='done', archived_at=timezone.now())
        ids = lambda query: {row['id'] for row in self.client.get(self.url, query).json()}
        self.assertEqual(ids({'state': 'open'}), {active.pk})
        self.assertEqual(ids({'state': 'closed'}), {done.pk, cancelled.pk})
        self.assertEqual(ids({'purpose': 'documents'}), {active.pk})
        self.assertEqual(self.client.get(self.url, {'state': 'bad'}).status_code, 400)

    @patch('telegrambot.tasks.notify_task_created.delay')
    def test_document_job_has_deadline_and_does_not_repeat_after_completion(self, notify):
        UonRequestRecord.objects.create(uon_id='907', date_begin=timezone.localdate() + timedelta(days=5))
        self.assertEqual(check_document_issuance_deadlines(), 1)
        task = Task.objects.get(uon_record_id='907')
        self.assertEqual(task.purpose, 'documents'); self.assertIsNotNone(task.deadline)
        task.title = 'Новое название'; task.status = 'done'; task.save()
        self.assertEqual(check_document_issuance_deadlines(), 0)

    @patch('telegrambot.tasks.notify_task_created.delay')
    def test_queued_initial_contact_cannot_return_after_winning(self, notify):
        lead = Lead.objects.create(name='Клиент')
        self.win(lead)
        create_new_lead_task(lead.pk)
        self.assertEqual(Task.objects.filter(lead=lead).exclude(purpose='follow_up_6m').count(), 0)

    @patch('telegrambot.tasks.notify_task_created.delay')
    def test_stale_or_queued_contact_cannot_revive_work_for_successful_uon_request(self, notify):
        record = UonRequestRecord.objects.create(uon_id='908', status_name='В работе')
        lead = Lead.objects.create(name='Клиент', uon_request_id='908')
        record.status_name = 'Успешная'; record.save()
        Lead.objects.filter(pk=lead.pk).update(updated_at=timezone.now() - timedelta(days=3))
        create_new_lead_task(lead.pk); check_stale_leads()
        self.assertEqual(Task.objects.filter(lead=lead, purpose='general').count(), 0)
        notify.assert_not_called()

    def test_exception_types_cannot_be_daily_and_auto_followup_stays_linked(self):
        response = self.client.post(self.url, {'title': 'Документы', 'purpose': 'documents', 'is_recurring': True}, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        lead = Lead.objects.create(name='Клиент'); self.win(lead)
        task = Task.objects.get(origin='after_sale')
        response = self.client.patch(f'{self.url}{task.pk}/', {'purpose': 'general'}, content_type='application/json')
        self.assertEqual(response.status_code, 400)
