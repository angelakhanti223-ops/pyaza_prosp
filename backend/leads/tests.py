from django.contrib.auth import get_user_model
from django.test import TestCase

from integrations.models import UonDeal

from .models import Direction, Lead

User = get_user_model()


class LeadDetailUonDealTests(TestCase):
    """Карточка заявки показывает данные обращения (сделки) из U-ON-зеркала, если оно
    уже синхронизировано — панель добавлена к существующей странице «Заявки», не
    заменяет собой редактирование статуса/менеджера/комментариев (ТЗ по требованию клиента)."""

    def setUp(self):
        self.head = User.objects.create_user(username='head', password='x', role=User.Role.HEAD)
        self.direction = Direction.objects.create(name='Турция')
        self.client.force_login(self.head)

    def test_uon_deal_null_without_ticket(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction)
        response = self.client.get(f'/api/crm/leads/{lead.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['uon_deal'])

    def test_uon_deal_null_when_not_yet_synced(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, uon_ticket_id='900')
        response = self.client.get(f'/api/crm/leads/{lead.id}/')
        self.assertIsNone(response.json()['uon_deal'])

    def test_uon_deal_present_when_synced(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, uon_ticket_id='900')
        UonDeal.objects.create(uon_id='900', name='Сделка', status_name='В работе', amount='5000.00')

        response = self.client.get(f'/api/crm/leads/{lead.id}/')

        deal_data = response.json()['uon_deal']
        self.assertIsNotNone(deal_data)
        self.assertEqual(deal_data['status_name'], 'В работе')
        self.assertEqual(deal_data['amount'], '5000.00')
