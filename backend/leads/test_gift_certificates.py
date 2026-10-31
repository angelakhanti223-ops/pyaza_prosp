import json
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase
from emailing.models import EmailSubscriber
from .gift_certificates import CONSENTS
from .models import Lead


class GiftCertificateApplicationTests(TestCase):
    def setUp(self):
        self.payload = dict(name='Тестовый клиент', phone='+7 (999) 123-45-67', email='gift-test@example.com',
                            comment='Подарок к юбилею', amount=25000, consent_personal_data=True,
                            consent_communication=True, consent_marketing=False, consent_version=CONSENTS['version'])

    def submit(self, **changes):
        return self.client.post('/api/gift-certificates/', {**self.payload, **changes}, content_type='application/json')

    @patch('leads.tasks.create_new_lead_task.delay')
    @patch('emailing.tasks.send_lead_notification_task.delay')
    @patch('integrations.tasks.sync_lead_to_uon.delay')
    def test_creates_crm_application_with_exact_evidence_and_no_marketing(self, sync, notify, task):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.submit()
        self.assertEqual(response.status_code, 201, response.content)
        lead = Lead.objects.get()
        self.assertEqual(lead.source, Lead.Source.SITE_FORM)
        self.assertIn('Заявка на подарочный сертификат', lead.initial_comment)
        self.assertIn('25 000 ₽', lead.initial_comment)
        self.assertIn('рассылки: нет', lead.initial_comment)
        evidence = lead.gift_certificate_application
        self.assertEqual(evidence['version'], CONSENTS['version'])
        self.assertEqual(evidence['capture_method'], 'preselected_checkboxes_submitted')
        self.assertTrue(evidence['consents']['communication']['accepted'])
        self.assertFalse(evidence['consents']['marketing']['accepted'])
        self.assertEqual(evidence['consents']['personal_data']['text'], '\n\n'.join(CONSENTS['documents']['personal-data']['paragraphs']))
        self.assertEqual(evidence['inn'], CONSENTS['inn'])
        self.assertFalse(lead.contact.allow_email_marketing)
        self.assertFalse(lead.contact.allow_messenger_marketing)
        self.assertFalse(EmailSubscriber.objects.exists())
        for mock in (sync, notify, task):
            mock.assert_called_once_with(lead.id)

    def test_both_application_consents_are_mandatory_and_strict_booleans(self):
        for field in ('consent_personal_data', 'consent_communication'):
            for value in (False, 'true', 'false', 'on', 1, None):
                with self.subTest(field=field, value=value):
                    self.assertEqual(self.submit(**{field:value}).status_code, 400)
        self.assertFalse(Lead.objects.exists())

    def test_missing_required_consent_or_outdated_version_rejected(self):
        for field in ('consent_personal_data', 'consent_communication'):
            payload = {k:v for k,v in self.payload.items() if k != field}
            self.assertEqual(self.client.post('/api/gift-certificates/', payload, content_type='application/json').status_code, 400)
        self.assertEqual(self.submit(consent_version='old').status_code, 400)
        self.assertFalse(Lead.objects.exists())

    def test_explicit_marketing_consent_registers_subscription(self):
        response = self.submit(consent_marketing=True)
        self.assertEqual(response.status_code, 201, response.content)
        lead = Lead.objects.get()
        subscriber = EmailSubscriber.objects.get()
        self.assertEqual(subscriber.source_lead_id, lead.id)
        self.assertTrue(subscriber.is_active)
        self.assertIsNotNone(subscriber.consented_at)
        self.assertTrue(lead.contact.allow_email_marketing)
        self.assertTrue(lead.contact.allow_messenger_marketing)

    def test_declined_marketing_does_not_reactivate_old_subscription(self):
        subscriber = EmailSubscriber.objects.create(email=self.payload['email'], is_active=False)
        self.assertEqual(self.submit().status_code, 201)
        subscriber.refresh_from_db()
        self.assertFalse(subscriber.is_active)
        self.assertIsNone(subscriber.consented_at)

    def test_email_and_amount_optional_and_marketing_defaults_false(self):
        payload = {k:v for k,v in self.payload.items() if k not in ('email','amount','consent_marketing')}
        response = self.client.post('/api/gift-certificates/', payload, content_type='application/json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertIsNone(Lead.objects.get().gift_certificate_application['amount'])
        self.assertFalse(EmailSubscriber.objects.exists())

    def test_invalid_contacts_amount_and_marketing_are_rejected(self):
        for changes in ({'phone':'wrongnumber'}, {'phone':'123'}, {'email':'invalid'}, {'amount':0},
                        {'amount':-10}, {'amount':1.5}, {'comment':'a'*3001}, {'consent_marketing':'yes'}):
            with self.subTest(changes=changes):
                self.assertEqual(self.submit(**changes).status_code, 400)
        self.assertFalse(Lead.objects.exists())

    def test_frontend_and_backend_consent_texts_are_identical(self):
        frontend = Path(__file__).resolve().parents[2]/'frontend/src/content/giftConsents.json'
        if frontend.exists():
            self.assertEqual(json.loads(frontend.read_text()), CONSENTS)


class PublicApplicationSessionCsrfTests(TestCase):
    """Public forms must work even when this browser has an active CRM session."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        from django.test import Client
        self.client = Client(enforce_csrf_checks=True)
        user = get_user_model().objects.create_user(username='gift-session-test', password='test-password')
        self.client.force_login(user)
        # A CRM tab may have already set the cookie; the public form sends no
        # CSRF header. This reproduces "CSRF token missing" with real middleware.
        self.client.cookies['csrftoken'] = 'a' * 32
        for target in ('leads.tasks.create_new_lead_task.delay',
                       'emailing.tasks.send_lead_notification_task.delay',
                       'integrations.tasks.sync_lead_to_uon.delay'):
            patcher = patch(target)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.payload = dict(name='Тест сертификата', phone='+79991234567', amount=25000,
                            consent_personal_data=True, consent_communication=True,
                            consent_marketing=False, consent_version=CONSENTS['version'])

    def test_gift_with_crm_session_and_no_csrf_token_is_created(self):
        response = self.client.post('/api/gift-certificates/', self.payload, content_type='application/json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Lead.objects.count(), 1)
        self.assertTrue(Lead.objects.get().gift_certificate_application)

    def test_public_tour_enquiry_with_crm_session_is_created(self):
        from .consents import PUBLIC_CONSENT_VERSION
        response = self.client.post('/api/leads/', dict(name='Тест тура', phone='+79991234567',
                                    consent=True, consent_marketing=False,
                                    consent_version=PUBLIC_CONSENT_VERSION), content_type='application/json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Lead.objects.count(), 1)

    def test_gift_validation_still_rejects_missing_consent(self):
        response = self.client.post('/api/gift-certificates/', {**self.payload, 'consent_personal_data':False},
                                    content_type='application/json')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertFalse(Lead.objects.exists())

    def test_internal_crm_still_requires_csrf_for_session_requests(self):
        response = self.client.post('/api/crm/leads/', {'name':'Не создавать', 'phone':'+79991234567'},
                                    content_type='application/json')
        self.assertEqual(response.status_code, 403, response.content)
        self.assertIn('CSRF', response.json()['detail'])
        self.assertFalse(Lead.objects.exists())
