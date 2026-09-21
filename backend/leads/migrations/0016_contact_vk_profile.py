from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0015_contact_entity_refactor'),
    ]

    operations = [
        migrations.AddField(
            model_name='contact',
            name='vk_profile',
            field=models.CharField(blank=True, max_length=255, verbose_name='ВК'),
        ),
    ]
