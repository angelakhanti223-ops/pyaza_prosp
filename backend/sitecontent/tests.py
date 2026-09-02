from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import Certificate, TeamMember

User = get_user_model()


class TeamMemberPublicListTests(TestCase):
    def test_lists_only_active_members_in_order(self):
        TeamMember.objects.create(name='Скрытая', role='X', is_active=False, order=0)
        TeamMember.objects.create(name='Вторая', role='Менеджер', order=2)
        TeamMember.objects.create(name='Первая', role='Руководитель', order=1)

        response = self.client.get('/api/team/')

        self.assertEqual(response.status_code, 200)
        names = [item['name'] for item in response.json()]
        self.assertEqual(names, ['Первая', 'Вторая'])

    def test_anonymous_can_read(self):
        response = self.client.get('/api/team/')
        self.assertEqual(response.status_code, 200)


class CertificatePublicListTests(TestCase):
    def test_lists_only_active_certificates_in_order(self):
        Certificate.objects.create(title='Скрытый', image='certificates/x.jpg', is_active=False)
        Certificate.objects.create(title='Второй', image='certificates/b.jpg', order=2)
        Certificate.objects.create(title='Первый', image='certificates/a.jpg', order=1)

        response = self.client.get('/api/certificates/')

        self.assertEqual(response.status_code, 200)
        titles = [item['title'] for item in response.json()]
        self.assertEqual(titles, ['Первый', 'Второй'])


class TeamMemberCrmViewSetTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='teammanager', password='x', role=User.Role.MANAGER)
        self.client.force_login(self.manager)

    def test_create_team_member(self):
        response = self.client.post('/api/crm/team/', {
            'name': 'Екатерина Макеева', 'role': 'Менеджер по туризму',
            'bio': 'Специалист по Абхазии, Турции, Стамбулу и Таиланду.',
            'phone': '89991104188', 'email': 'pnztour@mail.ru',
        }, content_type='application/json')

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(TeamMember.objects.count(), 1)

    def test_list_includes_inactive_members(self):
        TeamMember.objects.create(name='Скрытая', role='X', is_active=False)

        response = self.client.get('/api/crm/team/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        items = data if isinstance(data, list) else data['results']
        self.assertEqual(len(items), 1)

    def test_update_team_member(self):
        member = TeamMember.objects.create(name='Имя', role='Роль')

        response = self.client.patch(
            f'/api/crm/team/{member.id}/', {'role': 'Новая роль'}, content_type='application/json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        member.refresh_from_db()
        self.assertEqual(member.role, 'Новая роль')

    def test_delete_team_member(self):
        member = TeamMember.objects.create(name='Имя', role='Роль')

        response = self.client.delete(f'/api/crm/team/{member.id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(TeamMember.objects.filter(pk=member.pk).exists())

    def test_anonymous_rejected(self):
        self.client.logout()
        response = self.client.get('/api/crm/team/')
        self.assertEqual(response.status_code, 403)


class CertificateCrmViewSetTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='certmanager', password='x', role=User.Role.MANAGER)
        self.client.force_login(self.manager)

    def test_list_includes_inactive_certificates(self):
        Certificate.objects.create(title='Скрытый', image='certificates/x.jpg', is_active=False)

        response = self.client.get('/api/crm/certificates/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        items = data if isinstance(data, list) else data['results']
        self.assertEqual(len(items), 1)

    def test_delete_certificate(self):
        cert = Certificate.objects.create(title='Сертификат', image='certificates/x.jpg')

        response = self.client.delete(f'/api/crm/certificates/{cert.id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Certificate.objects.filter(pk=cert.pk).exists())

    def test_anonymous_rejected(self):
        self.client.logout()
        response = self.client.get('/api/crm/certificates/')
        self.assertEqual(response.status_code, 403)
