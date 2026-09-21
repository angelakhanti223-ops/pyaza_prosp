from django.db import migrations, models
import django.db.models.deletion


DEFAULT_TAGS = [
    ('Горячая заявка', 'red'),
    ('VIP', 'gold'),
    ('Семья с детьми', 'blue'),
    ('Повторный клиент', 'green'),
    ('Срочно', 'orange'),
    ('Контроль оплаты', 'purple'),
    ('Документы', 'gray'),
    ('Рассылка', 'teal'),
]


def seed_tags_and_contacts(apps, schema_editor):
    Lead = apps.get_model('leads', 'Lead')
    LeadTag = apps.get_model('leads', 'LeadTag')
    LeadContact = apps.get_model('leads', 'LeadContact')

    for name, color in DEFAULT_TAGS:
        LeadTag.objects.update_or_create(name=name, defaults={'color': color, 'is_active': True})

    for lead in Lead.objects.all().only('id', 'phone', 'email'):
        if lead.phone:
            LeadContact.objects.update_or_create(
                lead_id=lead.id,
                type='phone',
                value=lead.phone,
                defaults={
                    'label': 'Основной телефон из заявки',
                    'is_primary': True,
                    'allow_marketing': False,
                },
            )
        if lead.email:
            LeadContact.objects.update_or_create(
                lead_id=lead.id,
                type='email',
                value=lead.email,
                defaults={
                    'label': 'Email из заявки',
                    'is_primary': not bool(lead.phone),
                    'allow_marketing': True,
                },
            )


def unseed_tags_and_contacts(apps, schema_editor):
    LeadTag = apps.get_model('leads', 'LeadTag')
    LeadContact = apps.get_model('leads', 'LeadContact')
    LeadTag.objects.filter(name__in=[name for name, _ in DEFAULT_TAGS]).delete()
    LeadContact.objects.filter(label__in=['Основной телефон из заявки', 'Email из заявки']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0013_status_labels'),
    ]

    operations = [
        migrations.CreateModel(
            name='LeadTag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=80, unique=True, verbose_name='Название метки')),
                ('color', models.CharField(blank=True, help_text='CSS-цвет или служебное имя цвета', max_length=20, verbose_name='Цвет')),
                ('is_active', models.BooleanField(default=True, verbose_name='Активна')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.AddField(
            model_name='lead',
            name='preferred_messenger',
            field=models.CharField(choices=[('phone', 'Телефон'), ('whatsapp', 'WhatsApp'), ('telegram', 'Telegram'), ('max', 'MAX'), ('email', 'Email'), ('other', 'Другое')], default='phone', max_length=20, verbose_name='Приоритетный мессенджер / канал связи'),
        ),
        migrations.AddField(
            model_name='lead',
            name='tags',
            field=models.ManyToManyField(blank=True, related_name='leads', to='leads.leadtag', verbose_name='Метки заявки'),
        ),
        migrations.CreateModel(
            name='LeadContact',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[('phone', 'Телефон'), ('whatsapp', 'WhatsApp'), ('telegram', 'Telegram'), ('max', 'MAX'), ('email', 'Email'), ('other', 'Другое')], max_length=20, verbose_name='Тип контакта')),
                ('value', models.CharField(max_length=255, verbose_name='Значение контакта')),
                ('label', models.CharField(blank=True, max_length=100, verbose_name='Комментарий / кому принадлежит')),
                ('is_primary', models.BooleanField(default=False, verbose_name='Основной контакт')),
                ('allow_marketing', models.BooleanField(default=True, verbose_name='Можно использовать для рассылок')),
                ('note', models.TextField(blank=True, verbose_name='Примечание')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('lead', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contacts', to='leads.lead')),
            ],
            options={
                'ordering': ['-is_primary', 'type', 'value'],
                'unique_together': {('lead', 'type', 'value')},
            },
        ),
        migrations.AddIndex(
            model_name='leadcontact',
            index=models.Index(fields=['type', 'value'], name='leads_leadc_type_0a9bcd_idx'),
        ),
        migrations.AddIndex(
            model_name='leadcontact',
            index=models.Index(fields=['allow_marketing', 'type'], name='leads_leadc_allow_m_1a2bcd_idx'),
        ),
        migrations.RunPython(seed_tags_and_contacts, unseed_tags_and_contacts),
    ]
