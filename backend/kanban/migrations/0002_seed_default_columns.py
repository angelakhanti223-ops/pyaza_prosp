from django.db import migrations

DEFAULT_COLUMNS = ['Новая', 'В работе', 'Ждём клиента', 'Готово']


def seed_columns(apps, schema_editor):
    KanbanColumn = apps.get_model('kanban', 'KanbanColumn')
    for order, name in enumerate(DEFAULT_COLUMNS):
        KanbanColumn.objects.get_or_create(name=name, defaults={'order': order})


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('kanban', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_columns, noop),
    ]
