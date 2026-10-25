from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('leads', '0020_restore_ekaterina_october_bonus')]
    operations = [migrations.AddField(
        model_name='lead', name='gift_certificate_application',
        field=models.JSONField(blank=True, default=dict, verbose_name='Заявка на подарочный сертификат и согласия'),
    )]
