from django.db import migrations
from django.utils import timezone


ARTICLE_SLUG = 'gde-otdohnut-na-vesennih-kanikulah'


def publish_article(apps, schema_editor):
    Article = apps.get_model('articles', 'Article')
    article = Article.objects.get(slug=ARTICLE_SLUG)
    now = timezone.now()
    fields = []
    if article.status != 'published':
        article.status = 'published'
        fields.append('status')
    if article.published_at is None or article.published_at > now:
        article.published_at = now
        fields.append('published_at')
    if fields:
        article.save(update_fields=fields)


class Migration(migrations.Migration):
    dependencies = [('articles', '0019_seed_spring_holidays_article')]
    operations = [migrations.RunPython(publish_article, migrations.RunPython.noop)]
