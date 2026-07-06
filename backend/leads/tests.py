from django.contrib.auth import get_user_model
from django.test import TestCase

from integrations.models import UonRequestRecord

from .models import Direction, Lead

User = get_user_model()


class LeadDetailUonRequestTests(TestCase):
    """Карточка заявки показывает данные заявки из U-ON-зеркала, если она уже
    синхронизирована — панель добавлена к существующей странице «Заявки», не
    заменяет собой редактирование статуса/менеджера/комментариев (ТЗ по требованию клиента)."""

    def setUp(self):
        self.head = User.objects.create_user(username='head', password='x', role=User.Role.HEAD)
        self.direction = Direction.objects.create(name='Турция')
        self.client.force_login(self.head)

    def test_uon_request_null_without_ticket(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction)
        response = self.client.get(f'/api/crm/leads/{lead.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['uon_request'])

    def test_uon_request_null_when_not_yet_synced(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, uon_ticket_id='900')
        response = self.client.get(f'/api/crm/leads/{lead.id}/')
        self.assertIsNone(response.json()['uon_request'])

    def test_uon_request_present_when_synced(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, uon_ticket_id='900')
        UonRequestRecord.objects.create(uon_id='900', client_name='Иван Иванов', status_name='В работе')

        response = self.client.get(f'/api/crm/leads/{lead.id}/')

        data = response.json()['uon_request']
        self.assertIsNotNone(data)
        self.assertEqual(data['status_name'], 'В работе')
        self.assertEqual(data['client_name'], 'Иван Иванов')
