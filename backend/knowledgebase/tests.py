from django.contrib.auth import get_user_model
from django.test import TestCase

from leads.models import Direction

from .models import KnowledgeArticle

User = get_user_model()


class KnowledgeArticleApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='kbuser', password='x')
        self.direction = Direction.objects.create(name='Мальдивы')
        self.client.force_login(self.user)

    def test_list_shows_articles(self):
        KnowledgeArticle.objects.create(title='Мальдивы: база знаний', direction=self.direction, content='<p>Текст</p>')

        response = self.client.get('/api/crm/knowledge-base/')

        self.assertEqual(response.status_code, 200)
        data = response.json()['results']
        titles = [a['title'] for a in data]
        self.assertIn('Мальдивы: база знаний', titles)

    def test_detail_returns_content(self):
        article = KnowledgeArticle.objects.create(title='Мальдивы', direction=self.direction, content='<p>Текст статьи</p>')

        response = self.client.get(f'/api/crm/knowledge-base/{article.id}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['content'], '<p>Текст статьи</p>')

    def test_any_authenticated_user_can_create(self):
        response = self.client.post('/api/crm/knowledge-base/', {
            'title': 'Новая статья', 'direction': self.direction.id, 'content': '<p>Новый текст</p>',
        })

        self.assertEqual(response.status_code, 201)
        article = KnowledgeArticle.objects.get(title='Новая статья')
        self.assertEqual(article.author, self.user)

    def test_any_authenticated_user_can_edit(self):
        article = KnowledgeArticle.objects.create(title='Старое', direction=self.direction, content='<p>Старый текст</p>')

        response = self.client.patch(
            f'/api/crm/knowledge-base/{article.id}/', {'content': '<p>Новый текст</p>'}, content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        article.refresh_from_db()
        self.assertEqual(article.content, '<p>Новый текст</p>')

    def test_requires_authentication(self):
        self.client.logout()
        response = self.client.get('/api/crm/knowledge-base/')
        self.assertEqual(response.status_code, 403)


class ImportKnowledgeHtmlCommandTests(TestCase):
    """Импорт HTML-документа с встроенными base64-картинками — вынимает каждую
    картинку в отдельный файл, чтобы не хранить десятки мегабайт в одном поле."""

    def test_extracts_base64_images_into_separate_files(self):
        import base64
        import tempfile
        from io import StringIO
        from pathlib import Path

        from django.core.management import call_command

        # 1x1 транспарентный PNG.
        tiny_png = base64.b64encode(
            base64.b64decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
            )
        ).decode()

        html = f'''<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body><h1>Заголовок</h1><img alt="фото" src="data:image/png;base64,{tiny_png}"></body></html>'''

        with tempfile.TemporaryDirectory() as tmp_dir:
            html_path = Path(tmp_dir) / 'test.html'
            html_path.write_text(html, encoding='utf-8')

            out = StringIO()
            call_command(
                'import_knowledge_html', str(html_path),
                title='Тестовая статья', direction='Тест-направление', stdout=out,
            )

        article = KnowledgeArticle.objects.get(title='Тестовая статья')
        self.assertEqual(article.direction.name, 'Тест-направление')
        self.assertNotIn('data:image', article.content)
        self.assertIn('/media/knowledgebase/', article.content)
        self.assertIn('Картинок сохранено: 1', out.getvalue())
