from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('integrations', '0005_uonclient_address_uonclient_birthday_uonclient_city_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='UonFollowupChain',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('lead_id', models.CharField(max_length=64, verbose_name='ID обращения в U-ON')),
                ('status_entered_at', models.DateTimeField(verbose_name='Момент входа в статус 2')),
                ('step', models.PositiveSmallIntegerField(choices=[(0, 'Первое касание (+24ч)'), (1, 'Второе касание (+48ч)'), (2, 'Эскалация (+96ч)')], default=0, verbose_name='Шаг цепочки')),
                ('reminder_id', models.CharField(blank=True, max_length=64, verbose_name='ID последней задачи в U-ON')),
                ('next_fire_at', models.DateTimeField(verbose_name='Когда сработает следующий шаг')),
                ('state', models.CharField(choices=[('active', 'Активна'), ('closed_client_replied', 'Закрыта: клиент ответил'), ('closed_status_moved', 'Закрыта: статус изменился'), ('closed_escalated', 'Закрыта: эскалирована менеджеру'), ('closed_refused', 'Закрыта: отказ/удаление')], default='active', max_length=30, verbose_name='Состояние')),
                ('last_client_action_at', models.DateTimeField(blank=True, null=True, verbose_name='Последнее действие клиента')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'цепочка автозадач U-ON',
                'verbose_name_plural': 'цепочки автозадач U-ON',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='uonfollowupchain',
            constraint=models.UniqueConstraint(fields=('lead_id', 'status_entered_at'), name='uniq_uon_followup_chain_entry'),
        ),
    ]
