from django.db import migrations, models


STATUS_CHOICES = [
    ('new', 'Новая'),
    ('follow_up', 'Назначена повторная связь'),
    ('in_progress', 'В работе'),
    ('selection', 'Подборка'),
    ('options_proposed', 'Предложены варианты'),
    ('booked', 'Бронь'),
    ('prepaid', 'Внесена предоплата'),
    ('waiting_payment', 'Ожидаем полной оплаты'),
    ('paid', 'Оплачено'),
    ('departure', 'Вылет'),
    ('check_in', 'Заселение'),
    ('returned', 'Прилет'),
    ('closed_won', 'Закрыта (успех)'),
    ('closed_lost', 'Закрыта (отказ)'),
    ('failed', 'Провалена'),
    ('not_target', 'Нецелевой'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0009_alter_lead_status_alter_leadstatushistory_new_status_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='lead',
            name='status',
            field=models.CharField(choices=STATUS_CHOICES, default='new', max_length=20),
        ),
        migrations.AlterField(
            model_name='leadstatushistory',
            name='old_status',
            field=models.CharField(blank=True, choices=STATUS_CHOICES, max_length=20),
        ),
        migrations.AlterField(
            model_name='leadstatushistory',
            name='new_status',
            field=models.CharField(choices=STATUS_CHOICES, max_length=20),
        ),
        migrations.AddField(
            model_name='lead',
            name='departure_city',
            field=models.CharField(blank=True, max_length=100, verbose_name='Город вылета'),
        ),
        migrations.AddField(
            model_name='lead',
            name='departure_date',
            field=models.DateField(blank=True, null=True, verbose_name='Дата вылета'),
        ),
        migrations.AddField(
            model_name='lead',
            name='nights',
            field=models.PositiveSmallIntegerField(blank=True, null=True, verbose_name='Количество ночей'),
        ),
        migrations.AddField(
            model_name='lead',
            name='adults',
            field=models.PositiveSmallIntegerField(blank=True, null=True, verbose_name='Взрослых'),
        ),
        migrations.AddField(
            model_name='lead',
            name='children_count',
            field=models.PositiveSmallIntegerField(blank=True, null=True, verbose_name='Детей'),
        ),
        migrations.AddField(
            model_name='lead',
            name='children_ages',
            field=models.CharField(blank=True, max_length=100, verbose_name='Возраст детей'),
        ),
        migrations.AddField(
            model_name='lead',
            name='budget_from',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='Бюджет от'),
        ),
        migrations.AddField(
            model_name='lead',
            name='budget_to',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='Бюджет до'),
        ),
        migrations.AddField(
            model_name='lead',
            name='meal_type',
            field=models.CharField(blank=True, max_length=100, verbose_name='Питание'),
        ),
        migrations.AddField(
            model_name='lead',
            name='hotel_wishes',
            field=models.TextField(blank=True, verbose_name='Пожелания по отелю и отдыху'),
        ),
        migrations.AddField(
            model_name='lead',
            name='next_contact_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Следующий контакт'),
        ),
        migrations.AddField(
            model_name='lead',
            name='prepayment_amount',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='Предоплата'),
        ),
        migrations.AddField(
            model_name='lead',
            name='paid_amount',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='Оплачено туристом'),
        ),
        migrations.AddField(
            model_name='lead',
            name='balance_due',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='Остаток к оплате'),
        ),
        migrations.AddField(
            model_name='lead',
            name='full_payment_due_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Дедлайн полной оплаты'),
        ),
        migrations.AddField(
            model_name='lead',
            name='tour_operator',
            field=models.CharField(blank=True, max_length=100, verbose_name='Туроператор'),
        ),
        migrations.AddField(
            model_name='lead',
            name='booking_number',
            field=models.CharField(blank=True, max_length=100, verbose_name='Номер брони'),
        ),
        migrations.AddField(
            model_name='lead',
            name='failure_reason',
            field=models.CharField(blank=True, max_length=255, verbose_name='Причина отказа / нецелевой заявки'),
        ),
    ]
