from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from .models import Article, Category, Tag
from .utils import transliterate, unique_slug

User = get_user_model()


class TransliterateTests(TestCase):
    def test_transliterates_cyrillic_title(self):
        self.assertEqual(transliterate('Топ пляжей'), 'Top plyazhey')

    def test_leaves_ascii_untouched(self):
        self.assertEqual(transliterate('Top 10 beaches'), 'Top 10 beaches')


class UniqueSlugTests(TestCase):
    def test_generates_ascii_slug_from_cyrillic_title(self):
        slug = unique_slug(Article, 'Топ-10 пляжей Таиланда')
        self.assertRegex(slug, r'^[-a-zA-Z0-9_]+$')
        self.assertTrue(slug)

    def test_appends_suffix_on_collision(self):
        Article.objects.create(title='A', slug='top-10-plyazhey')
        slug = unique_slug(Article, 'Топ-10 пляжей')
        self.assertEqual(slug, 'top-10-plyazhey-2')

    def test_falls_back_when_title_has_no_translatable_characters(self):
        slug = unique_slug(Article, '!!!')
        self.assertEqual(slug, 'article')


class ArticleCrmViewSetTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='articlemanager', password='x', role=User.Role.MANAGER)
        self.client.force_login(self.manager)
        self.category = Category.objects.create(name='Пляжный отдых', slug='beach')

    def test_create_auto_generates_slug_from_title(self):
        response = self.client.post('/api/crm/articles/', {
            'title': 'Топ-10 пляжей Таиланда', 'content': '<p>Текст</p>', 'status': 'draft',
        }, content_type='application/json')

        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertTrue(data['slug'])
        self.assertRegex(data['slug'], r'^[-a-zA-Z0-9_]+$')
        self.assertEqual(data['author']['id'], self.manager.id)

    def test_create_respects_explicit_slug(self):
        response = self.client.post('/api/crm/articles/', {
            'title': 'Заголовок', 'slug': 'my-custom-slug', 'content': '<p>Текст</p>', 'status': 'draft',
        }, content_type='application/json')

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()['slug'], 'my-custom-slug')

    def test_create_rejects_duplicate_explicit_slug(self):
        Article.objects.create(title='Existing', slug='taken')

        response = self.client.post('/api/crm/articles/', {
            'title': 'Заголовок', 'slug': 'taken', 'content': '<p>Текст</p>', 'status': 'draft',
        }, content_type='application/json')

        self.assertEqual(response.status_code, 400)

    def test_create_with_tag_names_creates_tags(self):
        response = self.client.post('/api/crm/articles/', {
            'title': 'Заголовок', 'content': '<p>Текст</p>', 'status': 'draft',
            'tag_names': ['Пляжи', 'Турция'],
        }, content_type='application/json')

        self.assertEqual(response.status_code, 201, response.content)
        tag_names = {t['name'] for t in response.json()['tags']}
        self.assertEqual(tag_names, {'Пляжи', 'Турция'})
        self.assertEqual(Tag.objects.count(), 2)

    def test_create_reuses_existing_tag_by_name(self):
        Tag.objects.create(name='Пляжи', slug='plyazhi')

        response = self.client.post('/api/crm/articles/', {
            'title': 'Заголовок', 'content': '<p>Текст</p>', 'status': 'draft', 'tag_names': ['Пляжи'],
        }, content_type='application/json')

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Tag.objects.count(), 1)

    def test_update_does_not_regenerate_slug_from_new_title(self):
        article = Article.objects.create(title='Старый заголовок', slug='old-slug')

        response = self.client.patch(
            f'/api/crm/articles/{article.id}/', {'title': 'Совсем другой заголовок'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['slug'], 'old-slug')

    def test_update_allows_explicit_slug_change(self):
        article = Article.objects.create(title='Заголовок', slug='old-slug')

        response = self.client.patch(
            f'/api/crm/articles/{article.id}/', {'slug': 'new-slug'}, content_type='application/json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['slug'], 'new-slug')

    def test_list_shows_all_statuses_not_just_published(self):
        Article.objects.create(title='Черновик', slug='draft-1', status=Article.Status.DRAFT)
        Article.objects.create(title='Архив', slug='archived-1', status=Article.Status.ARCHIVED)

        response = self.client.get('/api/crm/articles/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        items = data if isinstance(data, list) else data['results']
        titles = {item['title'] for item in items}
        self.assertIn('Черновик', titles)
        self.assertIn('Архив', titles)

    def test_delete_article(self):
        article = Article.objects.create(title='Удалить меня', slug='delete-me')

        response = self.client.delete(f'/api/crm/articles/{article.id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Article.objects.filter(pk=article.pk).exists())

    def test_anonymous_rejected(self):
        self.client.logout()
        response = self.client.get('/api/crm/articles/')
        self.assertEqual(response.status_code, 403)


class CategoryCrmCreateViewTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='categorymanager', password='x', role=User.Role.MANAGER)
        self.client.force_login(self.manager)

    def test_creates_category_with_generated_slug(self):
        response = self.client.post(
            '/api/crm/articles/categories/', {'name': 'Пляжный отдых'}, content_type='application/json',
        )

        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(data['name'], 'Пляжный отдых')
        self.assertRegex(data['slug'], r'^[-a-zA-Z0-9_]+$')

    def test_anonymous_rejected(self):
        self.client.logout()
        response = self.client.post(
            '/api/crm/articles/categories/', {'name': 'Пляжный отдых'}, content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)


class ArticleViewCounterTests(TestCase):
    """Простой счётчик просмотров (без дедупликации по IP/сессии) — растёт
    при каждом открытии страницы статьи на сайте (ТЗ по требованию клиента,
    03.09.2026), виден в CRM рядом со статьёй."""

    def setUp(self):
        self.article = Article.objects.create(
            title='Статья', slug='statya', status=Article.Status.PUBLISHED, published_at=timezone.now(),
        )

    def test_public_detail_view_increments_views(self):
        self.assertEqual(self.article.views, 0)

        self.client.get(f'/api/articles/{self.article.slug}/')
        self.article.refresh_from_db()
        self.assertEqual(self.article.views, 1)

        self.client.get(f'/api/articles/{self.article.slug}/')
        self.article.refresh_from_db()
        self.assertEqual(self.article.views, 2)

    def test_public_list_view_does_not_increment_views(self):
        self.client.get('/api/articles/')
        self.article.refresh_from_db()
        self.assertEqual(self.article.views, 0)

    def test_crm_edit_does_not_increment_views(self):
        manager = User.objects.create_user(username='viewsmanager', password='x', role=User.Role.MANAGER)
        self.client.force_login(manager)

        self.client.get(f'/api/crm/articles/{self.article.id}/')

        self.article.refresh_from_db()
        self.assertEqual(self.article.views, 0)

    def test_views_field_visible_in_crm_list_and_detail(self):
        manager = User.objects.create_user(username='viewslistmanager', password='x', role=User.Role.MANAGER)
        self.client.force_login(manager)
        self.client.get(f'/api/articles/{self.article.slug}/')  # 1 просмотр

        list_response = self.client.get('/api/crm/articles/')
        list_data = list_response.json()
        list_items = list_data if isinstance(list_data, list) else list_data['results']
        self.assertEqual(next(a for a in list_items if a['id'] == self.article.id)['views'], 1)

        detail_response = self.client.get(f'/api/crm/articles/{self.article.id}/')
        self.assertEqual(detail_response.json()['views'], 1)

    def test_views_read_only_in_crm_cannot_be_set_directly(self):
        manager = User.objects.create_user(username='viewsreadonlymanager', password='x', role=User.Role.MANAGER)
        self.client.force_login(manager)

        response = self.client.patch(
            f'/api/crm/articles/{self.article.id}/', {'views': 9999}, content_type='application/json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.article.refresh_from_db()
        self.assertEqual(self.article.views, 0)
