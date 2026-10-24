from datetime import date, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase
from django.utils import timezone

from .models import Article, PageReadSession
from .page_analytics import PUBLIC_PAGES


class PageReadEventTests(TestCase):
    url = '/api/pages/read-event/'

    def setUp(self):
        cache.clear()
        self.view_id = str(uuid4())

    def event(self, **values):
        return self.client.post(self.url, {'path': '/', 'view_id': self.view_id, 'active_ms': 0, 'kind': 'start', **values}, content_type='application/json')

    def test_all_public_sections_are_allowed(self):
        for path in PUBLIC_PAGES:
            self.assertEqual(self.event(path=path, view_id=str(uuid4())).status_code, 204, path)
        self.assertEqual(PageReadSession.objects.count(), len(PUBLIC_PAGES))

    def test_internal_routes_files_and_unknown_pages_are_rejected(self):
        for path in ['/crm', '/crm/articles', '/crm/newdasbord?token=private', '/admin/', '/api/leads/', '/candidates', '/candidate-form.html', '/uploads/secret.pdf', '/does-not-exist', '//crm', 'https://flypenza.ru/', '/%63rm', '/blog/../crm', '/tours/private', '/CRM', '/blog/a%2fb']:
            with self.subTest(path=path):
                self.assertEqual(self.event(path=path).status_code, 400)
        self.assertFalse(PageReadSession.objects.exists())

    def test_marketing_query_fragment_and_trailing_slash_are_not_stored(self):
        self.assertEqual(self.event(path='/tours/?utm_source=mail&phone=secret#form', title='Personal name').status_code, 204)
        row = PageReadSession.objects.get()
        self.assertEqual(row.path, '/tours')
        self.assertEqual(row.title, PUBLIC_PAGES['/tours'])

    def test_china_html_alias_has_one_canonical_session(self):
        self.assertEqual(self.event(path='/china-tour-builder.html').status_code, 204)
        self.assertEqual(self.event(path='/tours/china-constructor/', kind='end').status_code, 204)
        self.assertEqual(PageReadSession.objects.get().path, '/tours/china-constructor')

    def test_only_published_articles_can_start_tracking(self):
        article = Article.objects.create(title='Китай', slug='public-test', status='published', views=123)
        self.assertEqual(self.event(path='/blog/public-test').status_code, 204)
        article.refresh_from_db()
        self.assertEqual(article.views, 123)  # The existing article tracker owns that counter.
        self.assertEqual(PageReadSession.objects.get().title, 'Китай')
        for status, when in [('draft', None), ('published', timezone.now() + timedelta(days=1)), ('archived', timezone.now())]:
            Article.objects.filter(pk=article.pk).update(status=status, published_at=when)
            self.assertEqual(self.event(path='/blog/public-test', view_id=str(uuid4())).status_code, 404)
        self.assertEqual(self.event(path='/blog/not-found').status_code, 404)

    def test_duplicate_and_out_of_order_packets_keep_one_view_and_monotonic_time(self):
        self.event()
        PageReadSession.objects.update(started_at=timezone.now() - timedelta(minutes=2))
        self.event(kind='progress', active_ms=50000)
        self.event(kind='end', active_ms=10000)
        self.event()
        row = PageReadSession.objects.get()
        self.assertEqual(row.active_ms, 50000)
        self.assertTrue(row.duration_reported)

    def test_view_id_cannot_move_between_pages(self):
        self.event()
        self.assertEqual(self.event(path='/tours').status_code, 400)
        self.assertEqual(PageReadSession.objects.get().path, '/')

    def test_time_cap_and_bad_payload(self):
        self.event()
        self.event(kind='end', active_ms=7200000)
        self.assertLess(PageReadSession.objects.get().active_ms, 5000)
        for values in [{'active_ms': -1}, {'active_ms': 7200001}, {'view_id': 'bad'}, {'kind': 'wrong'}]:
            self.assertEqual(self.event(**values).status_code, 400)

    def test_crawlers_are_not_counted(self):
        response = self.client.post(self.url, {'path': '/', 'view_id': self.view_id, 'active_ms': 0, 'kind': 'start'}, content_type='application/json', HTTP_USER_AGENT='YandexBot')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(PageReadSession.objects.exists())

    def test_cookie_beacon_does_not_require_csrf(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(get_user_model().objects.create_user(username='page-reader'))
        response = client.post(self.url, {'path': '/', 'view_id': self.view_id, 'active_ms': 0, 'kind': 'end'}, content_type='application/json')
        self.assertEqual(response.status_code, 204)
        self.assertTrue(PageReadSession.objects.get().duration_reported)


class PageAnalyticsTests(TestCase):
    url = '/api/crm/pages/analytics/'

    def setUp(self):
        self.client.force_login(get_user_model().objects.create_user(username='page-report'))

    def session(self, path, when, seconds=0, measured=True, title='Тестовая страница'):
        return PageReadSession.objects.create(path=path, title=title, started_at=datetime.fromisoformat(when), active_ms=round(seconds * 1000), duration_reported=measured)

    def report(self, **params):
        with patch('articles.analytics.timezone.localdate', return_value=date(2026, 10, 24)):
            return self.client.get(self.url, {'start': '2026-10-23', 'end': '2026-10-24', **params})

    def test_anonymous_user_cannot_read_metrics(self):
        self.client.logout()
        self.assertIn(self.report().status_code, [401, 403])

    def test_weighted_average_zero_vs_unknown_and_previous_period(self):
        self.session('/', '2026-10-23T10:00:00+03:00', 60)
        self.session('/tours', '2026-10-23T11:00:00+03:00', 120)
        self.session('/tours', '2026-10-24T11:00:00+03:00', 0)
        self.session('/tours', '2026-10-24T12:00:00+03:00', 0, False)
        self.session('/', '2026-10-22T12:00:00+03:00', 10)
        response = self.report()
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['totals'], {'views': 4, 'previous_views': 1, 'change_percent': 300.0, 'measured_views': 3, 'avg_seconds': 60.0, 'all_time_views': 5})
        self.assertEqual(data['daily'][1]['avg_seconds'], 0)
        self.assertEqual(response['Cache-Control'], 'private, no-store')

    def test_moscow_day_boundaries_and_empty_days(self):
        self.session('/', '2026-10-22T20:59:59+00:00', 5)
        self.session('/', '2026-10-22T21:00:00+00:00', 10)
        self.session('/', '2026-10-24T21:00:00+00:00', 20)
        data = self.report().json()
        self.assertEqual(data['totals']['views'], 1)
        self.assertEqual(data['totals']['previous_views'], 1)
        self.assertEqual(data['daily'], [
            {'date': '2026-10-23', 'views': 1, 'measured_views': 1, 'avg_seconds': 10.0},
            {'date': '2026-10-24', 'views': 0, 'measured_views': 0, 'avg_seconds': None},
        ])
        self.assertEqual(data['period']['previous_start'], '2026-10-21')
        self.assertEqual(data['period']['previous_end'], '2026-10-22')

    def test_page_filter_does_not_remove_selector_options(self):
        self.session('/', '2026-10-23T10:00:00+03:00', 60)
        self.session('/tours', '2026-10-23T10:00:00+03:00', 120)
        data = self.report(path='/tours/').json()
        self.assertEqual(data['totals']['views'], 1)
        self.assertEqual(data['totals']['avg_seconds'], 120)
        self.assertIn('/', [row['path'] for row in data['pages']])
        self.assertEqual(data['daily'][0]['views'], 1)

    def test_empty_catalogue_does_not_fabricate_historical_article_views(self):
        Article.objects.create(title='Архивный счётчик', slug='legacy', status='published', views=5000)
        data = self.report().json()
        self.assertEqual(data['totals']['all_time_views'], 0)
        self.assertIsNone(data['totals']['avg_seconds'])
        self.assertIsNone(data['first_recorded_at'])
        self.assertIn('/blog/legacy', [row['path'] for row in data['pages']])

    def test_internal_rows_cannot_appear_even_if_inserted_outside_the_api(self):
        for path in ['/crm', '/admin', '/api/leads', '/candidates', '/candidate-form.html']:
            self.session(path, '2026-10-23T10:00:00+03:00', 30)
        self.assertEqual(self.report().json()['totals']['views'], 0)
        self.assertEqual(self.report(path='/crm').status_code, 400)

    def test_historical_public_article_survives_article_deletion(self):
        article = Article.objects.create(title='Удалённая статья', slug='old-public', status='published')
        self.session('/blog/old-public', '2026-10-23T10:00:00+03:00', 60, title=article.title)
        article.delete()
        data = self.report(path='/blog/old-public').json()
        self.assertEqual(data['totals']['views'], 1)
        self.assertEqual(next(row for row in data['pages'] if row['path'] == '/blog/old-public')['title'], 'Удалённая статья')

    def test_invalid_ranges_and_unknown_pages(self):
        for params in [{'start': '2026-10-25'}, {'end': '2026-10-25'}, {'start': '2020-01-01'}, {'start': 'bad'}, {'path': '/private'}]:
            self.assertEqual(self.report(**params).status_code, 400, params)
        self.assertEqual(self.report(path='/blog/missing').status_code, 404)
