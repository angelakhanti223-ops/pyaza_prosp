from decimal import Decimal

from django.db import migrations

TIERS = [
    ('Минимум', Decimal('60000'), Decimal('15')),
    ('Базовый', Decimal('100000'), Decimal('16')),
    ('Развитие', Decimal('150000'), Decimal('17')),
]


def seed_tiers(apps, schema_editor):
    CommissionTier = apps.get_model('leads', 'CommissionTier')
    for name, threshold, commission_percent in TIERS:
        CommissionTier.objects.get_or_create(
            name=name, defaults={'threshold': threshold, 'commission_percent': commission_percent},
        )


def remove_tiers(apps, schema_editor):
    CommissionTier = apps.get_model('leads', 'CommissionTier')
    CommissionTier.objects.filter(name__in=[name for name, _, _ in TIERS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0007_commissiontier_remove_monthlyplan_commission_percent_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_tiers, remove_tiers),
    ]
