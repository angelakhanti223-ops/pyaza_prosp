from datetime import date, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase
from django.utils import timezone

from .models import Article, ArticleReadSession

User = get_user_model()


class ReadEventTests(TestCase):
    def setUp(self):
        cache.clear()
        self.article = Article.objects.create(title='Тест', slug='read-test', status='published', views=40)
        self.url = f'/api/articles/{self.article.slug}/read-event/'
        self.view_id = str(uuid4())

    def event(self, **kwargs):
        return self.client.post(self.url, {'view_id': self.view_id, 'active_ms': 0, 'kind': 'start', **kwargs}, content_type='application/json')

    def test_opening_is_idempotent_and_preserves_historical_counter(self):
        self.assertEqual(self.event().status_code, 204)
        self.assertEqual(self.event().status_code, 204)
        self.article.refresh_from_db()
        self.assertEqual(self.article.views, 41)
        self.assertEqual(ArticleReadSession.objects.count(), 1)
        self.assertFalse(ArticleReadSession.objects.get().duration_reported)
        self.assertEqual(self.event(view_id=str(uuid4())).status_code, 204)
        self.article.refresh_from_db()
        self.assertEqual(self.article.views, 42)

    def test_late_or_duplicate_packets_do_not_decrease_time_or_add_views(self):
        self.event()
        ArticleReadSession.objects.update(started_at=timezone.now() - timedelta(minutes=2))
        self.assertEqual(self.event(kind='progress', active_ms=50000).status_code, 204)
        self.event(kind='end', active_ms=20000)
        self.event()
        row = ArticleReadSession.objects.get()
        self.assertEqual(row.active_ms, 50000)
        self.assertTrue(row.duration_reported)
        self.article.refresh_from_db()
        self.assertEqual(self.article.views, 41)

    def test_claimed_time_cannot_exceed_server_observed_age(self):
        self.event()
        self.event(kind='end', active_ms=7200000)
        self.assertLess(ArticleReadSession.objects.get().active_ms, 5000)

    def test_bad_payload_is_rejected_without_writing(self):
        for values in [{'view_id': 'not-a-uuid'}, {'active_ms': -1}, {'active_ms': 7200001}, {'kind': 'bad'}]:
            with self.subTest(values=values):
                self.assertEqual(self.event(**values).status_code, 400)
        self.assertEqual(ArticleReadSession.objects.count(), 0)

    def test_cannot_reuse_view_id_for_another_article(self):
        self.event()
        other = Article.objects.create(title='Другая', slug='other-read', status='published')
        response = self.client.post(f'/api/articles/{other.slug}/read-event/', {'view_id': self.view_id, 'kind': 'start', 'active_ms': 0}, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        other.refresh_from_db()
        self.assertEqual(other.views, 0)

    def test_drafts_and_scheduled_articles_cannot_be_tracked(self):
        for status, when in [('draft', None), ('published', timezone.now() + timedelta(days=1)), ('archived', timezone.now())]:
            Article.objects.filter(pk=self.article.pk).update(status=status, published_at=when)
            self.assertEqual(self.event().status_code, 404)
        self.assertEqual(ArticleReadSession.objects.count(), 0)

    def test_known_crawler_is_not_counted(self):
        response = self.client.post(self.url, {'view_id': self.view_id, 'kind': 'start', 'active_ms': 0}, content_type='application/json', HTTP_USER_AGENT='Googlebot')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(ArticleReadSession.objects.count(), 0)

    def test_logged_in_beacon_does_not_require_a_csrf_token(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(User.objects.create_user(username='beacon-user'))
        response = client.post(self.url, {'view_id': self.view_id, 'kind': 'end', 'active_ms': 0}, content_type='application/json')
        self.assertEqual(response.status_code, 204)
        self.assertTrue(ArticleReadSession.objects.get().duration_reported)


class ArticleAnalyticsTests(TestCase):
    url = '/api/crm/articles/analytics/'

    def setUp(self):
        self.user = User.objects.create_user(username='analytics-manager')
        self.client.force_login(self.user)
        self.a = Article.objects.create(title='Пхукет', slug='analytics-phuket', status='published', views=100)
        self.b = Article.objects.create(title='Китай', slug='analytics-china', status='published', views=200)

    def session(self, article, when, seconds=0, measured=True):
        return ArticleReadSession.objects.create(article=article, started_at=datetime.fromisoformat(when), active_ms=round(seconds * 1000), duration_reported=measured)

    def report(self, **params):
        with patch('articles.analytics.timezone.localdate', return_value=date(2026, 10, 24)):
            return self.client.get(self.url, {'start': '2026-10-23', 'end': '2026-10-24', **params})

    def test_authentication_required(self):
        self.client.logout()
        self.assertEqual(self.report().status_code, 403)

    def test_weighted_average_excludes_missing_measurements_and_uses_moscow_dates(self):
        self.session(self.a, '2026-10-22T21:30:00+00:00', 120)  # 23 October in Moscow.
        for _ in range(3):
            self.session(self.b, '2026-10-24T10:00:00+00:00', 20)
        self.session(self.a, '2026-10-24T11:00:00+00:00', 0, measured=False)
        self.session(self.a, '2026-10-21T10:00:00+00:00', 50)  # Previous period.
        data = self.report().json()
        self.assertEqual(data['totals']['views'], 5)
        self.assertEqual(data['totals']['measured_views'], 4)
        self.assertEqual(data['totals']['avg_seconds'], 45)
        self.assertEqual(data['totals']['previous_views'], 1)
        self.assertEqual(data['totals']['change_percent'], 400)
        self.assertEqual(data['totals']['all_time_views'], 300)
        self.assertEqual(data['daily'][0]['views'], 1)
        self.assertEqual(data['daily'][0]['avg_seconds'], 120)
        self.assertEqual(data['daily'][1]['views'], 4)
        self.assertEqual(data['daily'][1]['avg_seconds'], 20)
        self.assertEqual(self.report()['Cache-Control'], 'private, no-store')

    def test_article_filter_changes_summary_and_chart_but_retains_article_choices(self):
        self.session(self.a, '2026-10-23T10:00:00+00:00', 90)
        self.session(self.b, '2026-10-24T10:00:00+00:00', 30)
        data = self.report(article_id=self.a.pk).json()
        self.assertEqual(data['totals']['views'], 1)
        self.assertEqual(data['totals']['avg_seconds'], 90)
        self.assertEqual(data['totals']['all_time_views'], 100)
        self.assertEqual(len(data['articles']), 2)
        self.assertEqual(data['daily'][1]['views'], 0)
        self.assertIsNone(data['daily'][1]['avg_seconds'])

    def test_empty_window_preserves_old_totals_without_inventing_history(self):
        data = self.report().json()
        self.assertEqual(data['totals']['views'], 0)
        self.assertIsNone(data['totals']['avg_seconds'])
        self.assertIsNone(data['first_recorded_at'])
        self.assertEqual(data['totals']['all_time_views'], 300)
        self.assertEqual(len(data['daily']), 2)
        self.assertTrue(all(day['views'] == 0 and day['avg_seconds'] is None for day in data['daily']))

    def test_zero_seconds_is_a_measurement_not_missing_data(self):
        self.session(self.a, '2026-10-23T10:00:00+00:00', 0)
        data = self.report().json()
        self.assertEqual(data['totals']['avg_seconds'], 0)
        self.assertEqual(data['totals']['measured_views'], 1)

    def test_invalid_or_future_range_and_unknown_article_are_rejected(self):
        for params in [{'start': 'bad'}, {'start': '2026-10-25'}, {'end': '2026-10-25'}, {'start': '2020-01-01'}, {'article_id': '-1'}]:
            with self.subTest(params=params):
                self.assertEqual(self.report(**params).status_code, 400)
        self.assertEqual(self.report(article_id=999999).status_code, 404)

    def test_previous_period_does_not_include_first_current_day(self):
        self.session(self.a, '2026-10-22T20:59:59+00:00', 10)
        self.session(self.a, '2026-10-22T21:00:00+00:00', 20)
        data = self.report().json()
        self.assertEqual(data['totals']['views'], 1)
        self.assertEqual(data['totals']['previous_views'], 1)
        self.assertEqual(data['totals']['avg_seconds'], 20)
