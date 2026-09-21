from django.db import migrations, models


SOURCE_CHOICES = [
    ('site_form', 'Сайт / форма'),
    ('sletat', 'Слетать.ру'),
    ('chatbot', 'Чат-бот'),
    ('phone_call', 'Телефонный звонок'),
    ('whatsapp', 'WhatsApp'),
    ('telegram', 'Telegram'),
    ('vk', 'ВК'),
    ('max', 'MAX'),
    ('office', 'Офис / личное обращение'),
    ('referral', 'Рекомендация'),
    ('repeat', 'Повторный клиент'),
    ('instagram', 'Instagram'),
    ('uon', 'U-ON'),
    ('other', 'Другое'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0016_contact_vk_profile'),
    ]

    operations = [
        migrations.AlterField(
            model_name='lead',
            name='source',
            field=models.CharField(choices=SOURCE_CHOICES, default='site_form', max_length=20),
        ),
    ]
