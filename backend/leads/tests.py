from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from integrations.models import UonLeadRecord

from .models import Direction, Lead

User = get_user_model()


class LeadDetailUonLeadTests(TestCase):
    """Карточка заявки показывает данные обращения из U-ON-зеркала, если оно уже
    синхронизировано — панель добавлена к существующей странице «Заявки», не
    заменяет собой редактирование статуса/менеджера/комментариев (ТЗ по требованию клиента).
    Lead.uon_ticket_id — это ID обращения (lead) в U-ON, не заявки (request) —
    это разные сущности с разными ID в этом API."""

    def setUp(self):
        self.head = User.objects.create_user(username='head', password='x', role=User.Role.HEAD)
        self.direction = Direction.objects.create(name='Турция')
        self.client.force_login(self.head)

    def test_uon_lead_null_without_ticket(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction)
        response = self.client.get(f'/api/crm/leads/{lead.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['uon_lead'])

    def test_uon_lead_null_when_not_yet_synced(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, uon_ticket_id='199')
        response = self.client.get(f'/api/crm/leads/{lead.id}/')
        self.assertIsNone(response.json()['uon_lead'])

    def test_uon_lead_present_when_synced(self):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, uon_ticket_id='199')
        UonLeadRecord.objects.create(uon_id='199', client_name='Иван Иванов', status_name='В работе')

        response = self.client.get(f'/api/crm/leads/{lead.id}/')

        data = response.json()['uon_lead']
        self.assertIsNotNone(data)
        self.assertEqual(data['status_name'], 'В работе')
        self.assertEqual(data['client_name'], 'Иван Иванов')


class LeadStatusChangeNotificationTests(TestCase):
    """Пуш менеджеру только на ключевые для денег переходы (бронь/оплата/отказ) —
    не на каждую смену статуса, решение заказчика 19.08.2026."""

    def setUp(self):
        self.head = User.objects.create_user(username='head', password='x', role=User.Role.HEAD)
        self.manager = User.objects.create_user(username='manager', password='x', role=User.Role.MANAGER)
        self.direction = Direction.objects.create(name='Турция')
        self.client.force_login(self.head)

    @patch('leads.views.notify_lead_status_change.delay')
    def test_notifies_on_transition_to_booked(self, mock_delay):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.IN_PROGRESS,
        )
        response = self.client.patch(
            f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.BOOKED}, content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        mock_delay.assert_called_once_with(lead.id, Lead.Status.BOOKED)

    @patch('leads.views.notify_lead_status_change.delay')
    def test_notifies_on_transition_to_paid(self, mock_delay):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.BOOKED,
        )
        self.client.patch(f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.PAID}, content_type='application/json')
        mock_delay.assert_called_once_with(lead.id, Lead.Status.PAID)

    @patch('leads.views.notify_lead_status_change.delay')
    def test_notifies_on_transition_to_closed_lost(self, mock_delay):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.IN_PROGRESS,
        )
        self.client.patch(
            f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.CLOSED_LOST}, content_type='application/json',
        )
        mock_delay.assert_called_once_with(lead.id, Lead.Status.CLOSED_LOST)

    @patch('leads.views.notify_lead_status_change.delay')
    def test_does_not_notify_on_routine_transition(self, mock_delay):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.NEW,
        )
        self.client.patch(
            f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.IN_PROGRESS}, content_type='application/json',
        )
        mock_delay.assert_not_called()

    @patch('leads.views.notify_lead_status_change.delay')
    def test_does_not_notify_when_status_unchanged(self, mock_delay):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.BOOKED,
        )
        self.client.patch(
            f'/api/crm/leads/{lead.id}/', {'status': Lead.Status.BOOKED}, content_type='application/json',
        )
        mock_delay.assert_not_called()
