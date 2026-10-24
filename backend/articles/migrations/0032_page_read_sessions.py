import uuid

from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):
    dependencies = [('articles', '0031_article_read_sessions')]
    operations = [
        migrations.CreateModel(
            name='PageReadSession',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('path', models.CharField(max_length=512)),
                ('title', models.CharField(max_length=255)),
                ('started_at', models.DateTimeField(default=timezone.now, editable=False)),
                ('last_seen_at', models.DateTimeField(default=timezone.now)),
                ('active_ms', models.PositiveIntegerField(default=0)),
                ('duration_reported', models.BooleanField(default=False)),
            ],
            options={'indexes': [
                models.Index(fields=['started_at'], name='page_read_started_idx'),
                models.Index(fields=['path', 'started_at'], name='page_read_path_idx'),
            ]},
        ),
    ]
