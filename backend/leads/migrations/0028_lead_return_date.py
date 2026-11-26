from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('leads', '0027_separate_operator_goals')]
    operations = [migrations.AddField(
        model_name='lead', name='return_date',
        field=models.DateField('Дата прилета / возвращения', blank=True, null=True),
    )]
