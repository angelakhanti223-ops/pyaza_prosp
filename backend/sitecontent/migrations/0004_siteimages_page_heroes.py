from django.db import migrations, models


PAGE_HERO_FIELDS = [
    ('tours_hero', 'Страница «Туры»'),
    ('directions_hero', 'Страница «Направления»'),
    ('cruises_hero', 'Страница «Круизы»'),
    ('promotions_hero', 'Страница «Акции»'),
    ('certificates_hero', 'Страница «Сертификаты»'),
    ('contacts_hero', 'Страница «Контакты»'),
    ('team_hero', 'Страница «Команда»'),
    ('about_hero', 'Страница «О компании»'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('sitecontent', '0003_alter_certificate_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='siteimages',
            name=name,
            field=models.ImageField(blank=True, null=True, upload_to='site/pages/', verbose_name=label),
        )
        for name, label in PAGE_HERO_FIELDS
    ]
