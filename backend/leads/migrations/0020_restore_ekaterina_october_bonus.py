from decimal import Decimal
import warnings

from django.db import migrations, models


def restore_october_bonus(apps, schema_editor):
    """One-time correction explicitly requested for October 2026.

    Historical months and other staff settings are not changed. Subsequent
    manual reductions survive: this operation only runs when deployed once.
    """
    User = apps.get_model('accounts', 'User')
    MonthlyPlan = apps.get_model('leads', 'MonthlyPlan')
    alias = schema_editor.connection.alias
    candidates = []
    for user in User.objects.using(alias).filter(role='manager', is_superuser=False):
        username = (user.username or '').strip().casefold()
        name = ' '.join([user.first_name or '', user.last_name or '']).strip().casefold()
        if username == 'ekaterina' or ('екатерина' in name.split() and 'макеева' in name.split()):
            candidates.append(user)
    if not candidates:
        warnings.warn('План октября: Екатерина Макеева / ekaterina не найдена; бонус не изменён.', RuntimeWarning)
        return
    if len(candidates) != 1:
        raise RuntimeError('Найдено несколько аккаунтов Екатерины: требуется выбрать конкретный аккаунт перед исправлением бонуса.')
    plan, created = MonthlyPlan.objects.using(alias).get_or_create(
        manager_id=candidates[0].pk, year=2026, month=10,
        defaults={'base_salary': Decimal('30000'), 'bonus_percent': Decimal('3')},
    )
    if not created:
        MonthlyPlan.objects.using(alias).filter(pk=plan.pk).update(bonus_percent=Decimal('3'))


class Migration(migrations.Migration):
    dependencies = [('leads', '0019_update_october_2026_work_schedule_3x3')]
    operations = [
        migrations.AlterField(
            model_name='monthlyplan', name='bonus_percent',
            field=models.DecimalField(
                '% от комиссии руководителя (SLA/ежедневные задачи)',
                max_digits=5, decimal_places=2, default=Decimal('3'),
                help_text='По умолчанию 3% в новом месяце. Руководитель может вручную снизить процент; сохранённое значение, включая 0%, не сбрасывается при расчёте.',
            ),
        ),
        migrations.RunPython(restore_october_bonus, migrations.RunPython.noop),
    ]
