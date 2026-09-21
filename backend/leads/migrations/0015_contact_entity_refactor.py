from django.db import migrations, models
import django.db.models.deletion


def split_name(full_name):
    parts = [part for part in (full_name or '').strip().split() if part]
    if len(parts) >= 3:
        return parts[0], parts[1], ' '.join(parts[2:])
    if len(parts) == 2:
        return parts[0], parts[1], ''
    if len(parts) == 1:
        return '', parts[0], ''
    return '', '', ''


def migrate_lead_contacts_to_client_contacts(apps, schema_editor):
    Lead = apps.get_model('leads', 'Lead')
    Contact = apps.get_model('leads', 'Contact')
    LeadContact = apps.get_model('leads', 'LeadContact')

    for lead in Lead.objects.all().iterator():
        old_contacts = list(LeadContact.objects.filter(lead_id=lead.id).order_by('-is_primary', 'id'))
        last_name, first_name, middle_name = split_name(lead.name)

        phone_values = []
        email_values = []
        preferred = getattr(lead, 'preferred_messenger', '') or 'phone'

        for old in old_contacts:
            value = (old.value or '').strip()
            if not value:
                continue
            if old.type in {'phone', 'whatsapp', 'telegram', 'max'}:
                if value not in phone_values:
                    phone_values.append(value)
                if old.is_primary and old.type in {'whatsapp', 'telegram', 'max'}:
                    preferred = old.type
            elif old.type == 'email':
                if value not in email_values:
                    email_values.append(value)
                if old.is_primary:
                    preferred = 'email'

        if lead.phone and lead.phone not in phone_values:
            phone_values.insert(0, lead.phone)
        if lead.email and lead.email not in email_values:
            email_values.insert(0, lead.email)

        contact = Contact.objects.create(
            last_name=last_name,
            first_name=first_name or lead.name,
            middle_name=middle_name,
            email_primary=email_values[0] if email_values else '',
            email_secondary=email_values[1] if len(email_values) > 1 else '',
            phone_primary=phone_values[0] if phone_values else '',
            phone_secondary=phone_values[1] if len(phone_values) > 1 else '',
            preferred_contact_method=preferred if preferred in {'phone', 'whatsapp', 'telegram', 'max', 'vk', 'email', 'other'} else 'phone',
            allow_email_marketing=bool(email_values),
            allow_messenger_marketing=True,
        )
        lead.contact_id = contact.id
        lead.save(update_fields=['contact'])


def reverse_migrate_contacts(apps, schema_editor):
    # Откат данных из Contact обратно в старую LeadContact не выполняется: в штатном
    # сценарии эта миграция не откатывается на проде.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0014_lead_contacts_tags'),
    ]

    operations = [
        migrations.CreateModel(
            name='Contact',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('last_name', models.CharField(blank=True, max_length=120, verbose_name='Фамилия')),
                ('first_name', models.CharField(blank=True, max_length=120, verbose_name='Имя')),
                ('middle_name', models.CharField(blank=True, max_length=120, verbose_name='Отчество')),
                ('birth_date', models.DateField(blank=True, null=True, verbose_name='Дата рождения')),
                ('email_primary', models.EmailField(blank=True, max_length=254, verbose_name='Email основной')),
                ('email_secondary', models.EmailField(blank=True, max_length=254, verbose_name='Email дополнительный')),
                ('phone_primary', models.CharField(blank=True, max_length=32, verbose_name='Телефон основной')),
                ('phone_secondary', models.CharField(blank=True, max_length=32, verbose_name='Телефон дополнительный')),
                ('preferred_contact_method', models.CharField(choices=[('phone', 'Телефон'), ('whatsapp', 'WhatsApp'), ('telegram', 'Telegram'), ('max', 'MAX'), ('vk', 'ВК'), ('email', 'Email'), ('other', 'Другое')], default='phone', max_length=20, verbose_name='Предпочтительный тип связи')),
                ('allow_email_marketing', models.BooleanField(default=True, verbose_name='Можно использовать email для рассылок')),
                ('allow_messenger_marketing', models.BooleanField(default=True, verbose_name='Можно использовать мессенджеры для рассылок')),
                ('note', models.TextField(blank=True, verbose_name='Примечание')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['last_name', 'first_name', 'phone_primary'],
            },
        ),
        migrations.AddIndex(
            model_name='contact',
            index=models.Index(fields=['phone_primary'], name='leads_conta_phone_p_e14d31_idx'),
        ),
        migrations.AddIndex(
            model_name='contact',
            index=models.Index(fields=['email_primary'], name='leads_conta_email_p_64ad3f_idx'),
        ),
        migrations.AddIndex(
            model_name='contact',
            index=models.Index(fields=['preferred_contact_method'], name='leads_conta_preferr_22dc7a_idx'),
        ),
        migrations.AddField(
            model_name='lead',
            name='contact',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='leads', to='leads.contact', verbose_name='Клиент / контакт'),
        ),
        migrations.AlterField(
            model_name='lead',
            name='preferred_messenger',
            field=models.CharField(choices=[('phone', 'Телефон'), ('whatsapp', 'WhatsApp'), ('telegram', 'Telegram'), ('max', 'MAX'), ('vk', 'ВК'), ('email', 'Email'), ('other', 'Другое')], default='phone', max_length=20, verbose_name='Приоритетный мессенджер / канал связи'),
        ),
        migrations.RunPython(migrate_lead_contacts_to_client_contacts, reverse_migrate_contacts),
        migrations.DeleteModel(name='LeadContact'),
    ]
