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
    ('closed_won', 'Успешная'),
    ('closed_lost', 'Неуспешная'),
    ('failed', 'Провалена'),
    ('not_target', 'Нецелевой'),
]


class Migration(migrations.Migration):
    dependencies = [
        ('leads', '0012_touroperatorexchangerate'),
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
    ]
