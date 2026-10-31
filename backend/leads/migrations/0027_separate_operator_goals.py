from django.db import migrations, models


def split_november_targets(apps, schema_editor):
    Goals = apps.get_model('leads', 'OfficeGoals')
    Goals.objects.using(schema_editor.connection.alias).filter(year=2026, month=11).update(
        resort_target='500000.00', space_target='500000.00',
    )


class Migration(migrations.Migration):
    dependencies = [('leads', '0026_preserve_october_2026_office_goals')]
    operations = [
        migrations.AddField(model_name='officegoals', name='resort_target', field=models.DecimalField('Резорт, ₽', max_digits=12, decimal_places=2, null=True, blank=True)),
        migrations.AddField(model_name='officegoals', name='space_target', field=models.DecimalField('Спейс, ₽', max_digits=12, decimal_places=2, null=True, blank=True)),
        migrations.RunPython(split_november_targets, migrations.RunPython.noop),
    ]
