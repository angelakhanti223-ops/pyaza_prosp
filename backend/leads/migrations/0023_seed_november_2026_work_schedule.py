import logging
from datetime import date

from django.db import migrations


def _find_user(users, username, first_name, *, fallback=None):
    matches = list(users.filter(username__iexact=username))
    if not matches:
        matches = list(users.filter(first_name__iexact=first_name))
    if not matches and fallback:
        matches = list(users.filter(username__iexact=fallback))
    if len(matches) > 1:
        raise RuntimeError(f'Неоднозначный сотрудник для графика: {first_name}')
    return matches[0] if matches else None


def seed_november_schedule(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    WorkShift = apps.get_model('leads', 'WorkShift')
    alias = schema_editor.connection.alias
    User = User.objects.using(alias)
    elena = _find_user(User, 'elena', 'Елена', fallback='admin')
    ekaterina = _find_user(User, 'ekaterina', 'Екатерина')
    if not elena or not ekaterina:
        logging.getLogger(__name__).warning(
            'График ноября 2026 не заполнен: нужны учётные записи Елены и Екатерины.'
        )
        return
    if elena.pk == ekaterina.pk:
        raise RuntimeError('Для графика нужны два разных сотрудника.')
    for day in range(1, 31):
        manager = ekaterina if ((day - 1) // 3) % 2 == 0 else elena
        WorkShift.objects.using(alias).update_or_create(
            date=date(2026, 11, day), defaults={'manager_id': manager.pk},
        )


class Migration(migrations.Migration):
    dependencies = [('leads', '0022_lead_site_application_consents')]
    operations = [migrations.RunPython(seed_november_schedule, migrations.RunPython.noop)]
