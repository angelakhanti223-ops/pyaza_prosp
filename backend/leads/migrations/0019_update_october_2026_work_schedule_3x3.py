from datetime import date

from django.db import migrations


ELENA_DAYS = [1, 2, 3, 5, 7, 11, 13, 14, 17, 18, 23, 24, 25, 29, 30, 31]
EKATERINA_DAYS = [4, 6, 8, 9, 10, 12, 15, 16, 19, 20, 21, 22, 26, 27, 28]


def _norm(value):
    return (value or '').strip().lower()


def _find_user(User, usernames, name_parts):
    users = list(User.objects.all())
    username_set = {_norm(item) for item in usernames}
    for user in users:
        if _norm(getattr(user, 'username', '')) in username_set:
            return user

    name_parts = [_norm(item) for item in name_parts if item]
    for user in users:
        full_name = ' '.join([
            _norm(getattr(user, 'first_name', '')),
            _norm(getattr(user, 'last_name', '')),
            _norm(getattr(user, 'full_name', '')),
            _norm(getattr(user, 'username', '')),
        ])
        if all(part in full_name for part in name_parts):
            return user

    return None


def update_october_schedule(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    WorkShift = apps.get_model('leads', 'WorkShift')

    elena = _find_user(User, ['elena', 'admin'], ['елена'])
    ekaterina = _find_user(User, ['ekaterina'], ['екатерина'])

    if not elena or not ekaterina:
        return

    for day in ELENA_DAYS:
        WorkShift.objects.update_or_create(
            date=date(2026, 10, day),
            defaults={'manager': elena},
        )

    for day in EKATERINA_DAYS:
        WorkShift.objects.update_or_create(
            date=date(2026, 10, day),
            defaults={'manager': ekaterina},
        )


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0018_merge_october_schedule_and_lead_sources'),
    ]

    operations = [
        migrations.RunPython(update_october_schedule, migrations.RunPython.noop),
    ]
