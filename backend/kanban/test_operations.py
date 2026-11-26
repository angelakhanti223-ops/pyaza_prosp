from datetime import date, datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from integrations.models import UonRequestRecord
from leads.models import Lead
from .models import Task
from .operations import MOSCOW, trip_dates
from .services import column_for_status


class OperationsDashboardTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='trip-manager', first_name='Анна', last_name='Тестовая')
        self.other = get_user_model().objects.create_user(username='trip-other')
        self.client.force_login(self.user)
        self.now = datetime(2026, 11, 26, 8, tzinfo=dt_timezone.utc)
        self.clock = patch('django.utils.timezone.now', return_value=self.now)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        self.url = '/api/crm/operations/'

    def lead(self, **attrs):
        return Lead.objects.create(name='Турист', phone='+70000000000', assigned_manager=self.user,
                                   status=attrs.pop('status', Lead.Status.PAID), **attrs)

    def task(self, **attrs):
        return Task.objects.create(title=attrs.pop('title', 'Проверить поездку'),
                                   assignee=attrs.pop('assignee', self.user),
                                   column=column_for_status(attrs.pop('status', Task.Status.NEW)), **attrs)

    def get(self, **params):
        response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def test_access_and_no_mutation_on_read(self):
        self.lead(departure_date=date(2026, 11, 26), nights=7)
        before = Task.all_objects.count()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        self.assertEqual(Task.all_objects.count(), before)
        self.client.logout()
        self.assertIn(self.client.get(self.url).status_code, [401, 403])

    def test_date_priority_and_explicit_estimates(self):
        record = UonRequestRecord.objects.create(uon_id='100', date_begin=date(2026, 11, 27), date_end=date(2026, 12, 3))
        lead = self.lead(departure_date=date(2026, 11, 26), return_date=date(2026, 12, 2), nights=9, uon_request_id='100')
        trip = self.get(days=30)['returns'][0]
        self.assertEqual(trip['return_date'], '2026-12-02')
        self.assertEqual(trip['return_source'], 'crm')
        self.assertEqual(trip['departure_date'], '2026-11-26')
        lead.return_date = None
        lead.departure_date = None
        self.assertEqual(trip_dates(lead, record), (record.date_begin, record.date_end, 'uon', 'uon_tour_end'))
        record.date_end = None
        self.assertEqual(trip_dates(lead, record)[1:4], (date(2026, 12, 6), 'uon', 'estimated_nights'))
        lead.nights = 0
        self.assertEqual(trip_dates(lead, record)[1], record.date_begin)

    def test_full_inclusive_period_crosses_month_and_keeps_successful_future_trips(self):
        first = self.lead(departure_date=date(2026, 11, 26))
        last = self.lead(departure_date=date(2026, 12, 2))
        beyond = self.lead(departure_date=date(2026, 12, 3))
        won = self.lead(departure_date=date(2026, 11, 28))
        Lead.objects.filter(pk=won.pk).update(status=Lead.Status.CLOSED_WON)
        for status in [Lead.Status.CLOSED_LOST, Lead.Status.FAILED, Lead.Status.NOT_TARGET, Lead.Status.NEW, Lead.Status.OPTIONS_PROPOSED]:
            self.lead(departure_date=date(2026, 11, 27), status=status)
        data = self.get()
        self.assertEqual(data['period']['end'], '2026-12-02')
        self.assertEqual({t['lead_id'] for t in data['departures']}, {first.pk, last.pk, won.pk})
        self.assertNotIn(beyond.pk, [t['lead_id'] for t in data['departures']])

    def test_uon_only_trips_are_deduplicated_and_cancelled_local_leads_cannot_reappear(self):
        for uid in ['linked', 'only', 'cancelled', 'archived', 'failed-local']:
            UonRequestRecord.objects.create(uon_id=uid, client_name=uid, date_begin=date(2026, 11, 27),
                                            status_name='Отменена' if uid == 'cancelled' else 'Успешная',
                                            is_archive=uid == 'archived')
        local = self.lead(uon_request_id='linked')
        self.lead(uon_request_id='linked')
        self.lead(uon_request_id='failed-local', status=Lead.Status.CLOSED_LOST)
        data = self.get()
        self.assertEqual(len(data['departures']), 2)
        self.assertEqual({t['uon_id'] for t in data['departures']}, {'linked', 'only'})
        self.assertEqual(next(t for t in data['departures'] if t['uon_id'] == 'linked')['lead_id'], local.pk)

    def test_related_tasks_use_separate_request_ticket_namespaces_and_unique_ids(self):
        lead = self.lead(departure_date=date(2026, 11, 26), uon_request_id='100', uon_ticket_id='200')
        direct = self.task(lead=lead, uon_record_kind='request', uon_record_id='100')
        request = self.task(uon_record_kind='request', uon_record_id='100')
        ticket = self.task(uon_record_kind='lead', uon_record_id='200')
        wrong = self.task(uon_record_kind='request', uon_record_id='200')
        archived = self.task(lead=lead, archived_at=self.now)
        done = self.task(lead=lead, status=Task.Status.DONE)
        cancelled = self.task(lead=lead, status=Task.Status.CANCELLED)
        data = self.get()
        self.assertEqual(data['departures'][0]['task_ids'], sorted([direct.pk, request.pk, ticket.pk]))
        self.assertEqual({t['id'] for t in data['tasks']}, {direct.pk, request.pk, ticket.pk, wrong.pk})
        self.assertFalse({archived.pk, done.pk, cancelled.pk} & set(data['task_buckets']['all']))

    def test_task_buckets_use_moscow_days_and_all_rows_beyond_page_size(self):
        overdue = self.task(deadline=self.now - timedelta(days=1))
        today_overdue = self.task(deadline=self.now - timedelta(minutes=1))
        # 21:30 UTC is 00:30 of the following Moscow day.
        tomorrow = self.task(deadline=datetime(2026, 11, 26, 21, 30, tzinfo=dt_timezone.utc))
        for n in range(25):
            self.task(title=f'Без срока {n}')
        data = self.get(days=1)
        self.assertEqual(len(data['tasks']), 28)
        self.assertEqual(data['counts']['no_deadline'], 25)
        self.assertEqual(set(data['task_buckets']['overdue']), {overdue.pk, today_overdue.pk})
        self.assertEqual(data['task_buckets']['today'], [today_overdue.pk])
        self.assertNotIn(tomorrow.pk, data['task_buckets']['period'])

    def test_today_switches_at_moscow_midnight(self):
        with patch('django.utils.timezone.now', return_value=datetime(2026, 11, 26, 22, tzinfo=dt_timezone.utc)):
            data = self.get(days=1)
        self.assertEqual(data['today'], '2026-11-27')
        self.assertEqual(data['period']['start'], '2026-11-27')

    def test_manager_filter_scopes_both_trips_and_tasks_and_resolves_unique_uon_manager(self):
        first = self.lead(departure_date=date(2026, 11, 27))
        other = self.lead(departure_date=date(2026, 11, 27))
        Lead.objects.filter(pk=other.pk).update(assigned_manager=self.other)
        UonRequestRecord.objects.create(uon_id='mine', date_begin=date(2026, 11, 28), manager_name='Анна Тестовая')
        UonRequestRecord.objects.create(uon_id='unknown', date_begin=date(2026, 11, 28), manager_name='Неизвестный')
        mine = self.task(lead=first)
        self.task(assignee=self.other)
        data = self.get(assignee=self.user.pk)
        self.assertEqual({t['key'] for t in data['departures']}, {f'lead:{first.pk}', 'uon:mine'})
        self.assertEqual(data['task_buckets']['all'], [mine.pk])

    def test_missing_dates_and_invalid_return_never_become_planned_returns(self):
        missing = self.lead(departure_date=date(2026, 11, 25))
        invalid = self.lead(departure_date=date(2026, 11, 28), return_date=date(2026, 11, 27))
        data = self.get()
        self.assertEqual({t['lead_id'] for t in data['missing_dates']}, {missing.pk, invalid.pk})
        self.assertEqual(data['returns'], [])

    def test_return_date_is_editable_through_the_existing_crm_api(self):
        lead = self.lead(departure_date=date(2026, 11, 26), nights=7)
        response = self.client.patch(f'/api/crm/leads/{lead.pk}/', {'return_date': '2026-12-04'}, content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['return_date'], '2026-12-04')
        data = self.get(days=30)
        self.assertEqual(data['returns'][0]['return_date'], '2026-12-04')
        self.assertEqual(data['returns'][0]['return_source'], 'crm')

    def test_params_reject_bad_ranges_and_invalid_filters(self):
        for params in [{'days': 0}, {'days': 365}, {'start': '2026-02-30'}, {'assignee': 0},
                       {'start': '9999-12-31', 'days': 30}]:
            self.assertEqual(self.client.get(self.url, params).status_code, 400, params)
