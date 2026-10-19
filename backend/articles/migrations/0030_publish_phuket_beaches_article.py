from django.db import migrations
from django.utils import timezone


ARTICLE_SLUG = '5-plyazhey-phuketa-dlya-spokoynogo-otdyha'


def publish_article(apps, schema_editor):
    Article = apps.get_model('articles', 'Article')
    database = schema_editor.connection.alias
    article = Article.objects.using(database).get(slug=ARTICLE_SLUG)
    now = timezone.now()
    fields = []
    if article.status != 'published':
        article.status = 'published'
        fields.append('status')
    if article.published_at is None or article.published_at > now:
        article.published_at = now
        fields.append('published_at')
    if fields:
        article.save(using=database, update_fields=fields)


class Migration(migrations.Migration):
    dependencies = [('articles', '0029_seed_phuket_beaches_article')]
    operations = [migrations.RunPython(publish_article, migrations.RunPython.noop)]
