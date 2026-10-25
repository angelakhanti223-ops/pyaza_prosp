"""Gift applications: keep the exact consent evidence with the CRM lead."""
import json
import re
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import Contact, Lead
from .serializers import _sync_client_contact_from_lead

CONSENTS = json.loads(Path(__file__).with_name('gift_consents.json').read_text())


class StrictBooleanField(serializers.BooleanField):
    def to_internal_value(self, data):
        if type(data) is not bool:
            self.fail('invalid', input=data)
        return data


class GiftCertificateSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=30)
    email = serializers.EmailField(required=False, allow_blank=True)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=3000)
    amount = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=100000000)
    consent_personal_data = StrictBooleanField(write_only=True)
    consent_communication = StrictBooleanField(write_only=True)
    consent_marketing = StrictBooleanField(write_only=True, default=False)
    consent_version = serializers.CharField(write_only=True)

    def validate_phone(self, value):
        if re.search(r'[^\d+()\s-]', value) or not 10 <= len(re.sub(r'\D', '', value)) <= 15:
            raise serializers.ValidationError('Укажите телефон с кодом страны, например +7 (999) 123-45-67.')
        return value

    def validate(self, attrs):
        errors = {}
        for key in ('consent_personal_data', 'consent_communication'):
            if not attrs[key]:
                errors[key] = 'Это согласие необходимо для обработки заявки и связи с вами.'
        if attrs['consent_version'] != CONSENTS['version']:
            errors['consent_version'] = 'Текст согласия обновился. Обновите страницу и отправьте заявку снова.'
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        from emailing.models import EmailSubscriber
        from emailing.tasks import send_lead_confirmation_task, send_lead_notification_task
        from integrations.tasks import sync_lead_to_uon
        from .tasks import create_new_lead_task

        now = timezone.now()
        marketing = validated_data['consent_marketing']
        amount = validated_data.get('amount')
        comment = validated_data.get('comment', '')
        evidence = {
            'version': CONSENTS['version'], 'submitted_at': now.isoformat(),
            'operator': CONSENTS['operator'], 'inn': CONSENTS['inn'],
            'page': '/gift-certificates', 'amount': amount,
            'consents': {},
        }
        for key, document in [('personal_data', 'personal-data'), ('communication', 'communication'), ('marketing', 'marketing')]:
            evidence['consents'][key] = {
                'accepted': validated_data['consent_' + key],
                'document_url': '/gift-certificates/' + document,
                'title': CONSENTS['documents'][document]['title'],
                'text': '\n\n'.join(CONSENTS['documents'][document]['paragraphs']),
            }
        details = '\n'.join([
            'Заявка на подарочный сертификат',
            f'Сумма: {amount:,} ₽'.replace(',', ' ') if amount else 'Сумма: обсудить с менеджером',
            f'Комментарий: {comment}' if comment else '',
            'Согласие на обработку персональных данных: да',
            'Согласие на связь по заявке (телефон, email, мессенджеры): да',
            'Согласие на информационные и рекламные рассылки: ' + ('да' if marketing else 'нет'),
            'Версия согласий: ' + CONSENTS['version'],
            'Дата согласий: ' + timezone.localtime(now).strftime('%d.%m.%Y %H:%M:%S %Z'),
        ])
        lead = Lead.objects.create(
            name=validated_data['name'], phone=validated_data['phone'], email=validated_data.get('email', ''),
            source=Lead.Source.SITE_FORM, initial_comment=details,
            consent_personal_data_at=now, gift_certificate_application=evidence,
        )
        _sync_client_contact_from_lead(lead)
        Contact.objects.filter(pk=lead.contact_id).update(
            allow_email_marketing=marketing and bool(lead.email), allow_messenger_marketing=marketing,
        )
        if marketing:
            if lead.email:
                EmailSubscriber.objects.update_or_create(
                    email=lead.email,
                    defaults={'name': lead.name, 'source_lead': lead, 'is_active': True,
                              'consented_at': now, 'unsubscribed_at': None},
                )
        # Publish tasks only once the application and evidence have committed.
        transaction.on_commit(lambda: sync_lead_to_uon.delay(lead.id))
        transaction.on_commit(lambda: send_lead_notification_task.delay(lead.id))
        transaction.on_commit(lambda: create_new_lead_task.delay(lead.id))
        if settings.SEND_LEAD_CONFIRMATION_EMAIL:
            transaction.on_commit(lambda: send_lead_confirmation_task.delay(lead.id))
        return lead
