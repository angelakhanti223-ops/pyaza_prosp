from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase
from .models import EmailSubscriber


class PublicSubscriptionTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client(enforce_csrf_checks=True)

    def submit(self, **changes):
        return self.client.post('/api/subscribe/', {'email':'form-audit@example.com', 'consent':True, **changes}, content_type='application/json')

    def test_anonymous_subscription(self):
        self.assertEqual(self.submit().status_code, 201)
        self.assertTrue(EmailSubscriber.objects.get().is_active)

    def test_subscription_with_active_crm_session(self):
        user=get_user_model().objects.create_user(username='subscription-session', password='test')
        self.client.force_login(user)
        self.client.cookies['csrftoken']='a'*32
        self.assertEqual(self.submit().status_code, 201)

    def test_existing_active_subscription_is_idempotent(self):
        self.assertEqual(self.submit().status_code, 201)
        self.assertEqual(self.submit().status_code, 201)
        self.assertEqual(EmailSubscriber.objects.count(), 1)

    def test_explicit_resubscription_reactivates_same_record(self):
        subscriber=EmailSubscriber.objects.create(email='form-audit@example.com', is_active=False)
        self.assertEqual(self.submit().status_code, 201)
        subscriber.refresh_from_db()
        self.assertTrue(subscriber.is_active)
        self.assertIsNotNone(subscriber.consented_at)
        self.assertIsNone(subscriber.unsubscribed_at)
        self.assertEqual(EmailSubscriber.objects.count(),1)

    def test_bad_email_and_declined_or_missing_consent_rejected(self):
        for changes in ({'email':'invalid'},{'consent':False},{'consent':None}):
            self.assertEqual(self.submit(**changes).status_code,400)
        response=self.client.post('/api/subscribe/',{'email':'form-audit@example.com'},content_type='application/json')
        self.assertEqual(response.status_code,400)
        self.assertFalse(EmailSubscriber.objects.exists())

    def test_subscription_is_rate_limited(self):
        from unittest.mock import patch
        from rest_framework.throttling import ScopedRateThrottle
        with patch.object(ScopedRateThrottle, 'THROTTLE_RATES', {'subscribe':'1/hour'}):
            self.assertEqual(self.submit().status_code,201)
            self.assertEqual(self.submit(email='other@example.com').status_code,429)
