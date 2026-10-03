from django.db import migrations
from django.utils import timezone

ARTICLE_SLUG = 'kakie-gory-i-sklon-vam-podoydut'

ARTICLE_CONTENT = r'''
<section>
  <p><strong>Горнолыжный отдых начинается не со страны, а с правильного склона.</strong> Новичку не нужен курорт только для опытных райдеров, семье с детьми важнее школа и логистика, а уверенному лыжнику быстро станет скучно там, где мало трасс.</p>
  <p>На странице статьи размещён интерактивный тест: он помогает определить подходящий формат гор — учебные склоны, семейный курорт, активные трассы, фрирайд или премиальный альпийский отдых.</p>
  <div style="padding:16px;border-radius:18px;background:#eaf6ff;margin:24px 0;"><strong>Что внутри:</strong><br>типы трасс, направления России и зарубежья, курорты Азербайджана, Грузии, Турции, Китая, Швейцарии, Франции, Австрии, Италии и CTA для заявки на подбор тура.</div>
</section>
'''


def get_or_create_by_name_and_slug(Model, name, slug):
    obj = Model.objects.filter(name=name).first() or Model.objects.filter(slug=slug).first()
    if obj:
        changed = False
        if obj.name != name:
            obj.name = name
            changed = True
        if obj.slug != slug:
            obj.slug = slug
            changed = True
        if changed:
            obj.save(update_fields=['name', 'slug'])
        return obj
    return Model.objects.create(name=name, slug=slug)


def seed_article(apps, schema_editor):
    Category = apps.get_model('articles', 'Category')
    Tag = apps.get_model('articles', 'Tag')
    Article = apps.get_model('articles', 'Article')

    category = get_or_create_by_name_and_slug(Category, 'Советы туристам', 'sovety-turistam')

    article, _ = Article.objects.update_or_create(
        slug=ARTICLE_SLUG,
        defaults={
            'title': 'Какие горы и какой склон вам подойдут? Тест перед горнолыжным отпуском',
            'category': category,
            'excerpt': 'Пройдите тест и узнайте, какой формат горного отдыха вам подходит: учебные склоны, семейные курорты, активные трассы, фрирайд или премиальные Альпы.',
            'content': ARTICLE_CONTENT,
            'status': 'published',
            'published_at': timezone.now(),
            'seo_title': 'Какие горы и какой склон вам подойдут — тест для горнолыжного отдыха',
            'seo_description': 'Тест для выбора горнолыжного отдыха: тип склона, уровень трасс, страны и курорты России, Азербайджана, Грузии, Турции, Китая, Швейцарии, Франции и других направлений.',
        },
    )

    tags = [
        ('горы', 'gory'),
        ('горнолыжный отдых', 'gornolyzhnyj-otdyh'),
        ('лыжи', 'lyzhi'),
        ('сноуборд', 'snoubord'),
        ('фрирайд', 'frirajd'),
        ('Швейцария', 'shvejtsariya'),
        ('Франция', 'frantsiya'),
        ('Турция', 'turtsiya'),
        ('Грузия', 'gruziya'),
        ('Азербайджан', 'azerbajdzhan'),
    ]
    article.tags.set([get_or_create_by_name_and_slug(Tag, name, slug) for name, slug in tags])


def reverse_seed(apps, schema_editor):
    Article = apps.get_model('articles', 'Article')
    Article.objects.filter(slug=ARTICLE_SLUG).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('articles', '0011_seed_new_year_article'),
    ]

    operations = [
        migrations.RunPython(seed_article, reverse_seed),
    ]
