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

    def create_reminder(self, payload: dict) -> dict:
        """Создать задачу по обращению (U-ON: POST /{key}/reminder/create.json) —
        используется цепочкой автозадач «клиент молчит после подборки»."""
        raise NotImplementedError

    def close_reminder(self, reminder_id: str, done_u_id: str = '') -> None:
        """Закрыть задачу (U-ON: POST /{key}/reminder/close/{id}.json) — вызывается,
        когда цепочка гасится досрочно (клиент ответил), а задача уже была создана."""
        raise NotImplementedError

    def list_request_actions(self, request_id: str) -> list:
        """Касания (переписка/звонки) по обращению (U-ON: GET /{key}/request-action/{r_id}.json)
        — источник текста последнего исходящего сообщения для шаблона задачи."""
        raise NotImplementedError

    def create_request(self, payload: dict) -> dict:
        """Создать заявку (U-ON: POST /{key}/request/create.json) — перевод
        обращения в заявку из CRM."""
        raise NotImplementedError

    def update_request(self, request_id: str, payload: dict) -> dict:
        """Обновить заявку (U-ON: POST /{key}/request/update/{id}.json)."""
        raise NotImplementedError

    def list_statuses(self) -> list:
        """Справочник статусов заявки (U-ON: GET /{key}/status.json) — нужен
        для выбора нового статуса при обновлении, там принимаются ID, не текст."""
        raise NotImplementedError

    def list_managers(self) -> list:
        """Справочник менеджеров компании (U-ON: GET /{key}/manager.json) —
        аналогично, для переназначения ответственного по заявке."""
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

    def create_reminder(self, payload: dict) -> dict:
        return {'result': 200, 'id': f'MOCK-REMINDER-{uuid.uuid4().hex[:10]}', 'mock': True, 'echo': payload}

    def close_reminder(self, reminder_id: str, done_u_id: str = '') -> None:
        return None

    def list_request_actions(self, request_id: str) -> list:
        return []

    def create_request(self, payload: dict) -> dict:
        return {'result': 200, 'id': f'MOCK-REQUEST-{uuid.uuid4().hex[:10]}', 'mock': True, 'echo': payload}

    def update_request(self, request_id: str, payload: dict) -> dict:
        return {'result': 200, 'id': request_id, 'mock': True, 'echo': payload}

    def list_statuses(self) -> list:
        return [
            {'id': '1', 'name': 'Новая'},
            {'id': '2', 'name': 'В работе'},
            {'id': '3', 'name': 'Бронь'},
            {'id': '4', 'name': 'Закрыта (успех)'},
            {'id': '5', 'name': 'Закрыта (отказ)'},
        ]

    def list_managers(self) -> list:
        return [{'id': '1', 'name': 'Тестовый менеджер'}]


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

    def create_reminder(self, payload: dict) -> dict:
        # Response shape {"result": 200, "id": "..."} confirmed against a live call
        # (18.08.2026, заявка #61). ВАЖНО: manager_id и created_u_id документация
        # помечает как необязательные ("Обязательное? Нет"), но на практике их
        # отсутствие роняет сервер в 500 ("500 Server error", без деталей) —
        # подтверждено трижды (обращение 200, его id_system=198, и даже заведомо
        # рабочая заявка №61 без этих полей). Вызывающий код обязан их передавать.
        try:
            response = requests.post(
                f'{self.base_url}/{self.api_key}/reminder/create.json',
                data=payload,
                timeout=10,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UonAdapterError(str(exc)) from exc
        data = response.json()
        if str(data.get('result')) != '200':
            raise UonAdapterError(f'U-ON reminder/create.json вернул ошибку: {data}')
        return data

    def close_reminder(self, reminder_id: str, done_u_id: str = '') -> None:
        # done/done_u_id/done_datetime подтверждены в документации как необязательные —
        # но после того, как то же самое "необязательно" оказалось неправдой для
        # reminder/create (см. выше), на всякий случай передаём done_u_id, если он
        # известен. Best-effort: вызывающий код обязан гасить UonAdapterError, чтобы
        # неудачное закрытие никогда не блокировало саму цепочку.
        payload = {'done': '1'}
        if done_u_id:
            payload['done_u_id'] = done_u_id
        try:
            response = requests.post(
                f'{self.base_url}/{self.api_key}/reminder/close/{reminder_id}.json',
                data=payload,
                timeout=10,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UonAdapterError(str(exc)) from exc

    def list_request_actions(self, request_id: str) -> list:
        # NOT YET CONFIRMED — response key assumed to follow the "singular
        # endpoint noun as JSON key" convention seen on /reminder/{id}.json
        # ({"reminder": [...]}); falls back to the raw list if U-ON returns one
        # directly instead of wrapping it.
        try:
            response = requests.get(
                f'{self.base_url}/{self.api_key}/request-action/{request_id}.json',
                timeout=10,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UonAdapterError(str(exc)) from exc
        data = response.json()
        if isinstance(data, list):
            return data
        return data.get('request-action') or data.get('request_action') or []

    def create_request(self, payload: dict) -> dict:
        # Confirmed against the public API docs (api.u-on.ru/doc) and the
        # third-party PHP client (github.com/DrTeamRocks/uon), NOT yet against
        # a live call — same POST-form-body/{"result":200,"id":...} shape as
        # create_ticket above, which IS confirmed live.
        try:
            response = requests.post(
                f'{self.base_url}/{self.api_key}/request/create.json',
                data=payload,
                timeout=10,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UonAdapterError(str(exc)) from exc
        data = response.json()
        if str(data.get('result')) != '200':
            raise UonAdapterError(f'U-ON request/create.json вернул ошибку: {data}')
        return data

    def update_request(self, request_id: str, payload: dict) -> dict:
        # Same caveat as create_request — confirmed against docs/PHP client,
        # not yet against a live call.
        try:
            response = requests.post(
                f'{self.base_url}/{self.api_key}/request/update/{request_id}.json',
                data=payload,
                timeout=10,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UonAdapterError(str(exc)) from exc
        data = response.json()
        if str(data.get('result')) != '200':
            raise UonAdapterError(f'U-ON request/update.json вернул ошибку: {data}')
        return data

    def list_statuses(self) -> list:
        # Response wrapper key NOT confirmed live — guessing "status" by the
        # same "singular endpoint noun" convention as /reminder, /request-action
        # (see list_request_actions above), with a raw-list fallback.
        try:
            response = requests.get(f'{self.base_url}/{self.api_key}/status.json', timeout=10)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UonAdapterError(str(exc)) from exc
        data = response.json()
        if isinstance(data, list):
            return data
        return data.get('status') or data.get('statuses') or []

    def list_managers(self) -> list:
        # Response wrapper key NOT confirmed live — same caveat as list_statuses.
        try:
            response = requests.get(f'{self.base_url}/{self.api_key}/manager.json', timeout=10)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UonAdapterError(str(exc)) from exc
        data = response.json()
        if isinstance(data, list):
            return data
        return data.get('manager') or data.get('managers') or []


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


def build_request_payload(lead) -> dict:
    """Перевод обращения (Lead) в заявку U-ON — POST /request/create.json.
    Поля client (u_*) и note/source те же, что build_ticket_payload; price и
    status_id добавлены отдельно, если на обращении уже есть сумма/статус,
    которому есть соответствие в справочнике U-ON (см. leads.views —
    вызывающий код передаёт status_id явно, отсюда он не пытается его угадать)."""
    payload = {
        'u_name': lead.name,
        'u_phone': lead.phone,
        'u_email': lead.email,
        'note': lead.initial_comment,
        'source': lead.get_source_display(),
    }
    if lead.deal_amount is not None:
        payload['price'] = str(lead.deal_amount)
    return payload
