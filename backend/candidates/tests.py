import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Candidate
from .schema import FIELDS, SCHEMA


@override_settings(STORAGES={'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'}, 'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}})
class CandidateWorkflowTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.payload = {
            'requestId': str(uuid.uuid4()), 'consent': True,
            'consentVersion': SCHEMA['consent_version'], 'website': '', 'jobs': [],
            'lastName': 'Тестовая', 'firstName': 'Анна', 'middleName': 'Примеровна',
            'position': 'Продавец-консультант', 'jobCity': 'Пенза',
            'phone': '+7 (900) 000-00-00', 'birthDate': '1990-01-02',
            'citizenship': 'РФ', 'regCity': 'Пенза', 'sameAddress': True,
        }

    def submit(self, payload=None):
        return self.client.post(reverse('candidate-submit'), payload or self.payload, format='json')

    def candidate(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        return Candidate.objects.get(pk=response.data['id'])

    def test_submission_creates_complete_private_pdf_and_consent_snapshot(self):
        candidate = self.candidate()
        self.assertTrue(bytes(candidate.pdf_content).startswith(b'%PDF-'))
        self.assertEqual(candidate.consent_text, SCHEMA['consent_text'])
        self.assertEqual(candidate.consent_version, SCHEMA['consent_version'])
        self.assertEqual(candidate.data['liveCity'], 'Пенза')
        self.assertEqual(set(candidate.data), {field['key'] for field in FIELDS} | {'jobs'})
        self.assertEqual(candidate.full_name, 'Тестовая Анна Примеровна')
        self.assertEqual(set(self.submit().data), {'ok', 'id'})

    def test_retry_is_idempotent_and_cannot_replace_original_answers(self):
        candidate = self.candidate()
        original_pdf = bytes(candidate.pdf_content)
        retry = self.submit()
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.data['id'], str(candidate.id))
        changed = {**self.payload, 'firstName': 'Другое имя'}
        self.assertEqual(self.submit(changed).status_code, 409)
        self.assertEqual(Candidate.objects.count(), 1)
        candidate.refresh_from_db()
        self.assertEqual(bytes(candidate.pdf_content), original_pdf)

    def test_consent_is_required_and_not_inferred_from_truthy_strings(self):
        for value in (False, 'true', 'yes', 1, None):
            with self.subTest(value=value):
                self.assertEqual(self.submit({**self.payload, 'consent': value}).status_code, 400)
        self.assertFalse(Candidate.objects.exists())

    def test_rejects_stale_consent_invalid_documents_dates_and_jobs(self):
        invalid = [
            {'consentVersion': 'old'}, {'passportNumber': '1'}, {'birthDate': '3000-01-01'},
            {'birthDate': '1990-02-31'}, {'phone': 'not a phone'}, {'email': 'bad'},
            {'sameAddress': 'false'}, {'passportDate': '1980-01-01'},
            {'jobs': [{}] * 6}, {'jobs': ['bad']}, {'firstName': 'x' * 301},
            {'jobs': [{'from': '2020-01-01', 'to': '2010-01-01'}]}, {'website': 'spam'},
        ]
        for extra in invalid:
            cache.clear()
            with self.subTest(extra=extra):
                self.assertEqual(self.submit({**self.payload, **extra}).status_code, 400)
        self.assertFalse(Candidate.objects.exists())

    def test_rejects_anonymous_manager_head_and_staff_on_all_private_endpoints(self):
        candidate = self.candidate()
        users = [None]
        for role, staff in [('manager', False), ('head', False), ('manager', True)]:
            users.append(get_user_model().objects.create_user(username=f'{role}-{staff}', role=role, is_staff=staff))
        for user in users:
            self.client.force_authenticate(user=user)
            for name, kwargs in [('candidate-list', {}), ('candidate-detail', {'pk': candidate.pk}), ('candidate-pdf', {'pk': candidate.pk})]:
                url = reverse(name, kwargs=kwargs)
                with self.subTest(user=user, endpoint=name):
                    self.assertEqual(self.client.get(url).status_code, 403)
                    self.assertEqual(self.client.head(url).status_code, 403)
            self.assertEqual(self.client.patch(reverse('candidate-detail', kwargs={'pk': candidate.pk}), {'status': 'hired'}, format='json').status_code, 403)

    def test_admin_can_search_manage_and_download_exact_stored_pdf(self):
        candidate = self.candidate()
        admin = get_user_model().objects.create_superuser(username='candidate-admin', password='test-only-password')
        self.client.force_authenticate(admin)
        listing = self.client.get(reverse('candidate-list'), {'search': 'Тестовая', 'status': 'new'})
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data['count'], 1)
        self.assertNotIn('data', listing.data['results'][0])
        self.assertNotIn('pdf_content', listing.data['results'][0])
        self.assertEqual(self.client.get(reverse('candidate-list'), {'search': 'Нет такого'}).data['count'], 0)
        detail = reverse('candidate-detail', kwargs={'pk': candidate.pk})
        response = self.client.patch(detail, {'status': 'review', 'notes': 'Позвонить завтра', 'full_name': 'Подмена'}, format='json')
        self.assertEqual(response.status_code, 200)
        candidate.refresh_from_db()
        self.assertEqual(candidate.status, 'review')
        self.assertEqual(candidate.notes, 'Позвонить завтра')
        self.assertEqual(candidate.full_name, 'Тестовая Анна Примеровна')
        self.assertEqual(self.client.patch(detail, {'status': 'unknown'}, format='json').status_code, 400)
        pdf_url = reverse('candidate-pdf', kwargs={'pk': candidate.pk})
        pdf = self.client.get(pdf_url)
        self.assertEqual(pdf.status_code, 200)
        self.assertEqual(pdf.content, bytes(candidate.pdf_content))
        self.assertEqual(pdf['Cache-Control'], 'private, no-store')
        self.assertTrue(pdf['Content-Disposition'].startswith('inline;'))
        self.assertTrue(self.client.get(pdf_url, {'download': '1'})['Content-Disposition'].startswith('attachment;'))

    def test_pdf_failure_does_not_create_an_incomplete_candidate(self):
        with patch('candidates.views.create_candidate_pdf', side_effect=RuntimeError('PDF unavailable')):
            with self.assertRaises(RuntimeError):
                self.submit()
        self.assertFalse(Candidate.objects.exists())

    def test_public_submission_does_not_require_admin_session_or_csrf(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.assertEqual(self.submit().status_code, 201)

    def test_private_status_change_requires_csrf_with_real_session(self):
        candidate = self.candidate()
        admin = get_user_model().objects.create_superuser(username='session-admin', password='test-only-password')
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(admin)
        response = self.client.patch(reverse('candidate-detail', kwargs={'pk': candidate.pk}), {'status': 'hired'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_malformed_payload_and_throttle(self):
        url = reverse('candidate-submit')
        self.assertEqual(self.client.post(url, [], format='json').status_code, 400)
        self.assertEqual(self.client.post(url, '{broken', content_type='application/json').status_code, 400)
        for _ in range(8):
            self.submit({**self.payload, 'consent': False})
        self.assertEqual(self.submit().status_code, 429)
