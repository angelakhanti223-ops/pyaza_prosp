"""Frozen Sri Lanka knowledge article; existing staff edits are preserved."""
import hashlib
import json
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import migrations


def seed_sri_lanka(apps, schema_editor):
    data_dir = Path(__file__).resolve().parent.parent / 'data' / 'sri_lanka_20261006'
    data = json.loads((data_dir / 'data.json').read_text(encoding='utf-8'))
    Article = apps.get_model('knowledgebase', 'KnowledgeArticle')
    Direction = apps.get_model('leads', 'Direction')
    alias = schema_editor.connection.alias
    # Re-running or installing after manual publication must not replace staff work.
    if Article.objects.using(alias).filter(title=data['title']).exists():
        return
    content = (data_dir / 'content.html').read_text(encoding='utf-8')
    for image in data['images']:
        filename = image['image']
        raw = (data_dir / 'slides' / filename).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        destination = f'knowledgebase/sri-lanka-20261006/{digest}.jpg'
        if not default_storage.exists(destination):
            destination = default_storage.save(destination, ContentFile(raw))
        content = content.replace('{{image:' + filename + '}}', default_storage.url(destination))
    direction, _ = Direction.objects.using(alias).get_or_create(name=data['direction'])
    Article.objects.using(alias).create(title=data['title'], direction=direction, content=content)


class Migration(migrations.Migration):
    dependencies = [('knowledgebase', '0001_initial')]
    # Rollback preserves a collaborative article and its media files.
    operations = [migrations.RunPython(seed_sri_lanka, migrations.RunPython.noop)]
