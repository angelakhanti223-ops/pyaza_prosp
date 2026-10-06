import importlib
import json
import tempfile
from pathlib import Path
from types import SimpleNamespace

from django.apps import apps
from django.db import connection
from django.test import TestCase, override_settings

from knowledgebase.models import KnowledgeArticle


seed = importlib.import_module('knowledgebase.migrations.0002_seed_sri_lanka').seed_sri_lanka


class SriLankaSeedTests(TestCase):
    def setUp(self):
        # The migration is also applied when Django prepares the test database.
        KnowledgeArticle.objects.filter(title__startswith='Шри-Ланка:').delete()

    def test_publication_has_all_slides_and_preserves_edits(self):
        with tempfile.TemporaryDirectory() as media:
            with override_settings(MEDIA_ROOT=media, MEDIA_URL='/media/'):
                editor = SimpleNamespace(connection=connection)
                seed(apps, editor)
                article = KnowledgeArticle.objects.get(title__startswith='Шри-Ланка:')
                self.assertEqual(article.direction.name, 'Шри-Ланка')
                self.assertNotIn('{{image:', article.content)
                self.assertNotIn('data:image', article.content)
                self.assertEqual(len(list(Path(media).rglob('*.jpg'))), 38)
                self.assertIn('NH Bentota Ceysands', article.content)
                self.assertIn('Acknowledgement', article.content)
                article.content = '<p>Правка сотрудника</p>'
                article.save()
                seed(apps, editor)
                article.refresh_from_db()
                self.assertEqual(article.content, '<p>Правка сотрудника</p>')
                self.assertEqual(KnowledgeArticle.objects.filter(title__startswith='Шри-Ланка:').count(), 1)
                self.assertEqual(len(list(Path(media).rglob('*.jpg'))), 38)

    def test_every_hotel_and_resort_has_a_source_slide(self):
        root = Path(__file__).parent / 'data' / 'sri_lanka_20261006'
        data = json.loads((root / 'data.json').read_text(encoding='utf-8'))
        files = {item['image'] for item in data['images']}
        self.assertEqual(len(data['hotels']), 28)
        self.assertEqual(len(data['resorts']), 9)
        self.assertEqual(len(data['quiz']), 12)
        for item in data['hotels'] + data['resorts']:
            self.assertIn(item['image'], files)
            self.assertTrue((root / 'slides' / item['image']).is_file())
