import json
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from emailing.models import EmailSubscriber
from .consents import PUBLIC_CONSENT_VERSION, SITE_CONSENTS
from .models import Contact, Lead
from .serializers import LeadUpdateSerializer


class PublicLeadConsentTests(TestCase):
    def setUp(self):
        self.payload = {
            'name': 'Тестовый турист', 'phone': '+79990000000', 'email': 'tourist@example.test',
            'initial_comment': 'Пекин + Шанхай', 'consent': True,
            'consent_version': PUBLIC_CONSENT_VERSION,
        }
        for path in [
            'integrations.tasks.sync_lead_to_uon.delay',
            'emailing.tasks.send_lead_notification_task.delay',
            'leads.tasks.create_new_lead_task.delay',
        ]:
            mock = patch(path)
            mock.start()
            self.addCleanup(mock.stop)

    def submit(self, **changes):
        return self.client.post('/api/leads/', self.payload | changes, content_type='application/json')

    def test_required_consent_cannot_be_replaced_by_marketing(self):
        for value in [False, None]:
            with self.subTest(value=value):
                response = self.submit(consent=value, consent_marketing=True)
                self.assertEqual(response.status_code, 400)
                self.assertIn('consent', response.json())
        self.assertFalse(Lead.objects.exists())
        self.assertFalse(Contact.objects.exists())

    def test_missing_required_consent_is_rejected(self):
        payload = self.payload.copy()
        del payload['consent']
        response = self.client.post('/api/leads/', payload, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Lead.objects.exists())

    def test_marketing_is_optional_and_does_not_enable_contact_permissions(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201)
        lead = Lead.objects.get(pk=response.json()['id'])
        evidence = lead.site_application_consents
        self.assertTrue(evidence['consents']['personal_data']['accepted'])
        self.assertFalse(evidence['consents']['marketing']['accepted'])
        self.assertEqual(evidence['version'], PUBLIC_CONSENT_VERSION)
        self.assertEqual(evidence['submitted_at'], lead.consent_personal_data_at.isoformat())
        self.assertIn('Обратная связь входит в цель', evidence['consents']['personal_data']['text'])
        self.assertEqual(evidence['consents']['marketing']['document_url'], '/consents/marketing')
        self.assertEqual(evidence['consents']['marketing']['text'], '\n\n'.join(SITE_CONSENTS['documents']['marketing']['paragraphs']))
        self.assertFalse(lead.contact.allow_email_marketing)
        self.assertFalse(lead.contact.allow_messenger_marketing)
        self.assertFalse(EmailSubscriber.objects.exists())

    def test_explicit_marketing_opt_in_records_evidence_and_subscription(self):
        response = self.submit(consent_marketing=True)
        self.assertEqual(response.status_code, 201)
        lead = Lead.objects.get(pk=response.json()['id'])
        self.assertTrue(lead.site_application_consents['consents']['marketing']['accepted'])
        self.assertTrue(lead.contact.allow_email_marketing)
        self.assertTrue(lead.contact.allow_messenger_marketing)
        subscriber = EmailSubscriber.objects.get(email=lead.email)
        self.assertTrue(subscriber.is_active)
        self.assertEqual(subscriber.source_lead_id, lead.id)
        self.assertEqual(subscriber.consented_at, lead.consent_personal_data_at)

    def test_marketing_opt_in_without_email_does_not_create_email_subscription(self):
        response = self.submit(consent_marketing=True, email='')
        self.assertEqual(response.status_code, 201)
        contact = Lead.objects.get(pk=response.json()['id']).contact
        self.assertFalse(contact.allow_email_marketing)
        self.assertTrue(contact.allow_messenger_marketing)
        self.assertFalse(EmailSubscriber.objects.exists())

    def test_unchecked_marketing_does_not_reactivate_previous_unsubscribe(self):
        now = timezone.now()
        subscriber = EmailSubscriber.objects.create(email=self.payload['email'], is_active=False, unsubscribed_at=now)
        response = self.submit(consent_marketing=False)
        self.assertEqual(response.status_code, 201)
        subscriber.refresh_from_db()
        self.assertFalse(subscriber.is_active)
        self.assertEqual(subscriber.unsubscribed_at, now)
        self.assertIsNone(subscriber.consented_at)

    def test_stale_document_version_is_rejected(self):
        for version in ['', '2025-old', '2026-10-25.1']:
            with self.subTest(version=version):
                response = self.submit(consent_version=version)
                self.assertEqual(response.status_code, 400)
                self.assertIn('consent_version', response.json())
        self.assertFalse(Lead.objects.exists())

    def test_client_cannot_supply_consent_evidence(self):
        response = self.submit(site_application_consents={'version': 'forged', 'submitted_at': '2000-01-01', 'consents': {'marketing': {'accepted': True}}})
        self.assertEqual(response.status_code, 201)
        evidence = Lead.objects.get(pk=response.json()['id']).site_application_consents
        self.assertEqual(evidence['version'], PUBLIC_CONSENT_VERSION)
        self.assertFalse(evidence['consents']['marketing']['accepted'])

    def test_editing_comment_does_not_rewrite_evidence(self):
        response = self.submit()
        lead = Lead.objects.get(pk=response.json()['id'])
        evidence = lead.site_application_consents.copy()
        serializer = LeadUpdateSerializer(lead, data={'initial_comment': 'Уточнили маршрут', 'site_application_consents': {'forged': True}}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        lead.refresh_from_db()
        self.assertEqual(lead.initial_comment, 'Уточнили маршрут')
        self.assertEqual(lead.site_application_consents, evidence)

    def test_failed_subscription_rolls_back_lead_contact_and_evidence(self):
        with patch('emailing.models.EmailSubscriber.objects.update_or_create', side_effect=RuntimeError('test subscription failure')):
            with self.assertRaises(RuntimeError):
                self.submit(consent_marketing=True)
        self.assertFalse(Lead.objects.exists())
        self.assertFalse(Contact.objects.exists())

    def test_old_lead_does_not_gain_implied_consent(self):
        lead = Lead.objects.create(name='Старая заявка', phone='+79990000001')
        self.assertEqual(lead.site_application_consents, {})
        self.assertIsNone(lead.consent_personal_data_at)

    def test_backend_and_displayed_personal_data_document_are_identical(self):
        root = Path(__file__).resolve().parents[2]
        displayed = json.loads((root / 'frontend/src/content/leadConsents.json').read_text())
        self.assertEqual(displayed, SITE_CONSENTS)
        gift_displayed = json.loads((root / 'frontend/src/content/giftConsents.json').read_text())
        self.assertEqual(SITE_CONSENTS['based_on_gift_version'], gift_displayed['version'])
        self.assertEqual(SITE_CONSENTS['operator'], gift_displayed['operator'])
        self.assertEqual(SITE_CONSENTS['documents']['marketing']['paragraphs'][:2], gift_displayed['documents']['marketing']['paragraphs'][:2])
