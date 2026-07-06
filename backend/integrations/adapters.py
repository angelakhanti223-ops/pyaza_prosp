"""U-ON CRM adapter (ТЗ 8).

Two implementations behind one interface, selected purely by config
(`UON_MOCK_MODE` / `UON_API_KEY` in `.env`) — no code changes needed once
the client provides a real API key.
"""
import uuid

import requests
from django.conf import settings


class UonAdapterError(Exception):
    """Raised on any failure talking to U-ON — triggers the Celery retry queue."""


class BaseUonAdapter:
    def create_ticket(self, payload: dict) -> dict:
        raise NotImplementedError

    def list_reminders(self, request_id: str) -> list:
        """Напоминания/дела по заявке (U-ON: GET /{key}/reminder/{request_id}.json)."""
        raise NotImplementedError


class MockUonAdapter(BaseUonAdapter):
    """Used until a real U-ON API key is issued. Simulates a successful ticket creation."""

    def create_ticket(self, payload: dict) -> dict:
        return {
            'ticket_id': f'MOCK-{uuid.uuid4().hex[:10]}',
            'mock': True,
            'echo': payload,
        }

    def list_reminders(self, request_id: str) -> list:
        return []


class RealUonAdapter(BaseUonAdapter):
    def __init__(self, api_key: str, base_url: str):
        if not api_key:
            raise UonAdapterError('UON_API_KEY не задан — переключитесь на UON_MOCK_MODE=True.')
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')

    def create_ticket(self, payload: dict) -> dict:
        try:
            response = requests.post(
                f'{self.base_url}/api/deal/create',
                headers={'Authorization': f'Bearer {self.api_key}'},
                json=payload,
                timeout=10,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UonAdapterError(str(exc)) from exc
        return response.json()

    def list_reminders(self, request_id: str) -> list:
        # U-ON embeds the API key directly in the URL path (confirmed against
        # the live API), not as a Bearer header — unlike create_ticket above,
        # which was written before a real key existed and hasn't been verified
        # against the live API yet.
        try:
            response = requests.get(
                f'{self.base_url}/{self.api_key}/reminder/{request_id}.json',
                timeout=10,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UonAdapterError(str(exc)) from exc
        return response.json().get('reminder', [])


def get_uon_adapter() -> BaseUonAdapter:
    if settings.UON_MOCK_MODE:
        return MockUonAdapter()
    return RealUonAdapter(settings.UON_API_KEY, settings.UON_API_BASE_URL)


def build_ticket_payload(lead) -> dict:
    return {
        'name': lead.name,
        'phone': lead.phone,
        'email': lead.email,
        'comment': lead.initial_comment,
        'source': lead.get_source_display(),
        'direction': lead.direction.name if lead.direction_id else None,
    }
