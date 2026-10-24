import uuid
import django.db.models.deletion
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):
    dependencies = [('articles', '0030_publish_phuket_beaches_article')]
    operations = [
        migrations.AlterField(
            model_name='article', name='views',
            field=models.PositiveIntegerField(default=0, verbose_name='Просмотров', help_text='Исторический итог и новые открытия статьи в браузере. Повторная отправка одного события не увеличивает счётчик.'),
        ),
        migrations.CreateModel(
            name='ArticleReadSession',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('started_at', models.DateTimeField(default=timezone.now, editable=False)),
                ('last_seen_at', models.DateTimeField(default=timezone.now)),
                ('active_ms', models.PositiveIntegerField(default=0)),
                ('duration_reported', models.BooleanField(default=False)),
                ('article', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='read_sessions', to='articles.article')),
            ],
            options={'indexes': [
                models.Index(fields=['started_at'], name='article_read_started_idx'),
                models.Index(fields=['article', 'started_at'], name='article_read_article_idx'),
            ]},
        ),
    ]
