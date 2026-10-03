from datetime import date

from django.db import migrations


ELENA_DAYS = [1, 2, 3, 5, 7, 11, 13, 14, 17, 18, 20, 21, 24, 25, 28, 29]
EKATERINA_DAYS = [4, 6, 8, 9, 10, 12, 15, 16, 19, 22, 23, 26, 27, 30, 31]


def _norm(value):
    return (value or '').strip().lower()


def _full_name(user):
    return ' '.join([
        _norm(getattr(user, 'first_name', '')),
        _norm(getattr(user, 'last_name', '')),
        _norm(getattr(user, 'full_name', '')),
        _norm(getattr(user, 'username', '')),
    ])


def _find_user(User, usernames, name_parts, fallback_usernames=None):
    users = list(User.objects.all())
    username_set = {_norm(item) for item in usernames}
    for user in users:
        if _norm(getattr(user, 'username', '')) in username_set:
            return user

    name_parts = [_norm(item) for item in name_parts if item]
    for user in users:
        full_name = _full_name(user)
        if all(part in full_name for part in name_parts):
            return user

    fallback_set = {_norm(item) for item in (fallback_usernames or [])}
    for user in users:
        if _norm(getattr(user, 'username', '')) in fallback_set:
            return user

    return None


def seed_october_schedule(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    WorkShift = apps.get_model('leads', 'WorkShift')

    elena = _find_user(User, ['elena'], ['елена'], fallback_usernames=['admin'])
    ekaterina = _find_user(User, ['ekaterina'], ['екатерина'])

    if not elena or not ekaterina:
        # Do not break deploy if the production users were renamed manually.
        # The dates remain safe to create from Django admin.
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


def unseed_october_schedule(apps, schema_editor):
    WorkShift = apps.get_model('leads', 'WorkShift')
    WorkShift.objects.filter(date__gte=date(2026, 10, 1), date__lte=date(2026, 10, 31)).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0012_touroperatorexchangerate'),
    ]

    operations = [
        migrations.RunPython(seed_october_schedule, unseed_october_schedule),
    ]
