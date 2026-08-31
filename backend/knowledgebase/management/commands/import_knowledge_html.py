import base64
import re
import uuid
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError

from knowledgebase.models import KnowledgeArticle
from leads.models import Direction

# Матчит <img ... src="data:image/jpeg;base64,AAAA..." ...> — конкретно под
# документы-экспорты, где картинки лежат прямо в теле как data URI, а не файлами.
DATA_IMG_RE = re.compile(
    r'<img([^>]*)\ssrc="data:image/([a-zA-Z0-9.+-]+);base64,([^"]+)"([^>]*)>',
)


class Command(BaseCommand):
    help = (
        'Импорт готового HTML-документа (например, выгрузки из чата) в базу знаний CRM. '
        'Встроенные base64-картинки сохраняются отдельными файлами в MEDIA_ROOT — '
        'иначе одна статья с полусотней фото весит десятки мегабайт при каждой загрузке.'
    )

    def add_arguments(self, parser):
        parser.add_argument('html_path', type=str, help='Путь к HTML-файлу внутри контейнера')
        parser.add_argument('--title', type=str, required=True)
        parser.add_argument('--direction', type=str, default='', help='Название направления (создастся, если его нет)')
        parser.add_argument('--author', type=str, default='', help='username автора')
        parser.add_argument('--update-id', type=int, default=None, help='Обновить существующую статью вместо создания новой')

    def handle(self, *args, **options):
        path = Path(options['html_path'])
        if not path.exists():
            raise CommandError(f'Файл не найден: {path}')

        html = path.read_text(encoding='utf-8')

        body_match = re.search(r'<body[^>]*>(.*)</body>', html, re.DOTALL | re.IGNORECASE)
        if not body_match:
            raise CommandError('В документе не найден <body> — это не похоже на самодостаточный HTML-экспорт.')
        body = body_match.group(1)
        body = re.sub(r'<script\b.*?</script>', '', body, flags=re.DOTALL | re.IGNORECASE)
        body = re.sub(r'<style\b.*?</style>', '', body, flags=re.DOTALL | re.IGNORECASE)

        image_count = 0

        def _save_image(match):
            nonlocal image_count
            before_attrs, ext, b64data, after_attrs = match.groups()
            ext = 'jpg' if ext.lower() in ('jpeg', 'jpg') else ext.lower()
            try:
                raw = base64.b64decode(b64data)
            except (ValueError, TypeError):
                return match.group(0)
            saved_path = default_storage.save(f'knowledgebase/{uuid.uuid4().hex}.{ext}', ContentFile(raw))
            image_count += 1
            return f'<img{before_attrs} src="{default_storage.url(saved_path)}"{after_attrs}>'

        body = DATA_IMG_RE.sub(_save_image, body)

        direction = None
        if options['direction']:
            direction, _ = Direction.objects.get_or_create(name=options['direction'])

        author = None
        if options['author']:
            author = get_user_model().objects.filter(username=options['author']).first()
            if author is None:
                self.stdout.write(self.style.WARNING(f'Пользователь "{options["author"]}" не найден — автор не задан.'))

        if options['update_id']:
            article = KnowledgeArticle.objects.get(pk=options['update_id'])
            article.title = options['title']
            article.direction = direction
            article.content = body
            if author:
                article.author = author
            article.save()
            verb = 'обновлена'
        else:
            article = KnowledgeArticle.objects.create(
                title=options['title'], direction=direction, content=body, author=author,
            )
            verb = 'создана'

        self.stdout.write(self.style.SUCCESS(
            f'Статья «{article.title}» (#{article.id}) {verb}. Картинок сохранено: {image_count}.'
        ))
