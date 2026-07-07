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

    def get_request(self, request_id: str) -> dict | None:
        """Полная заявка по ID (U-ON: GET /{key}/request/{id}.json)."""
        raise NotImplementedError

    def get_lead(self, lead_id: str) -> dict | None:
        """Полное обращение (лид) по ID (U-ON: GET /{key}/lead/{id}.json)."""
        raise NotImplementedError


class MockUonAdapter(BaseUonAdapter):
    """Used until a real U-ON API key is issued. Simulates a successful ticket creation."""

    def create_ticket(self, payload: dict) -> dict:
        return {
            'result': 200,
            'id': f'MOCK-{uuid.uuid4().hex[:10]}',
            'mock': True,
            'echo': payload,
        }

    def list_reminders(self, request_id: str) -> list:
        return []

    def get_request(self, request_id: str) -> dict | None:
        return None

    def get_lead(self, lead_id: str) -> dict | None:
        return None


class RealUonAdapter(BaseUonAdapter):
    def __init__(self, api_key: str, base_url: str):
        if not api_key:
            raise UonAdapterError('UON_API_KEY не задан — переключитесь на UON_MOCK_MODE=True.')
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')

    def create_ticket(self, payload: dict) -> dict:
        # Confirmed against the live API: POST /{key}/lead/create.json (key in the
        # URL path, same as every other endpoint here — not the Bearer-auth
        # /api/deal/create this used to hit, which 404s because "deal" isn't a
        # real resource in this API). Form-urlencoded body, response shape is
        # {"result": 200, "id": "<new lead id>", "comment": "..."}.
        #
        # KNOWN ISSUE: Cyrillic values in u_name/note come back corrupted (stored
        # as literal "?" characters) regardless of whether the request body is
        # sent as UTF-8 or Windows-1251 — tested against the live API with both.
        # ASCII-only values (phone numbers, English names) round-trip fine. This
        # looks like a bug/quirk on U-ON's side; ask their support what encoding
        # u_name/note actually expect before relying on this for real (Cyrillic)
        # customer names.
        try:
            response = requests.post(
                f'{self.base_url}/{self.api_key}/lead/create.json',
                data=payload,
                timeout=10,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UonAdapterError(str(exc)) from exc
        data = response.json()
        if str(data.get('result')) != '200':
            raise UonAdapterError(f'U-ON lead/create.json вернул ошибку: {data}')
        return data

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

    def get_request(self, request_id: str) -> dict | None:
        # Confirmed against the live API: returns {"request": [{...}]} — a list
        # with a single item, even for a single-id lookup. There is no bulk list
        # endpoint in this API at all (GET /{key}/request.json, /deal.json and
        # /client.json all 404) — U-ON's integration model is webhook-based
        # (push), not list-based (pull). See UonWebhookView.
        try:
            response = requests.get(f'{self.base_url}/{self.api_key}/request/{request_id}.json', timeout=10)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UonAdapterError(str(exc)) from exc
        items = response.json().get('request', [])
        return items[0] if items else None

    def get_lead(self, lead_id: str) -> dict | None:
        # Confirmed against the live API: returns {"result": 200|404, "lead": [{...}]}.
        # "lead" (обращение) and "request" (заявка) are separate resources with
        # separate ID sequences in this API — a lead's id and id_system diverge
        # by a variable offset (not constant), unlike a request's, where they
        # usually match. There's no reliable way to convert between the two
        # from the API alone.
        try:
            response = requests.get(f'{self.base_url}/{self.api_key}/lead/{lead_id}.json', timeout=10)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UonAdapterError(str(exc)) from exc
        items = response.json().get('lead', [])
        return items[0] if items else None


def get_uon_adapter() -> BaseUonAdapter:
    if settings.UON_MOCK_MODE:
        return MockUonAdapter()
    return RealUonAdapter(settings.UON_API_KEY, settings.UON_API_BASE_URL)


def build_ticket_payload(lead) -> dict:
    # Field names confirmed against the live /lead/create.json response for
    # source/u_name/u_phone/note — u_email follows the same "u_"-prefixed
    # naming convention seen on client_email in /request and /lead reads, but
    # hasn't been individually confirmed as an accepted input field.
    return {
        'source': lead.get_source_display(),
        'u_name': lead.name,
        'u_phone': lead.phone,
        'u_email': lead.email,
        'note': lead.initial_comment,
    }
