from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('leads', '0021_lead_gift_certificate_application')]
    operations = [migrations.AddField(
        model_name='lead', name='site_application_consents',
        field=models.JSONField('Согласия по заявке с сайта', default=dict, blank=True),
    )]
