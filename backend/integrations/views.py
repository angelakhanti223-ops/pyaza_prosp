from django.conf import settings
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import is_head

from .models import UonClient, UonLeadRecord, UonRequestRecord, UonWebhookLog
from .serializers import UonClientSerializer, UonLeadRecordSerializer, UonRequestRecordSerializer
from .tasks import (
    handle_uon_chain_close,
    handle_uon_client_reply,
    handle_uon_status_change,
    sync_all_uon_leads,
    sync_all_uon_reminders,
    sync_uon_lead,
    sync_uon_request,
)

# type_id из doc_webhooks.php клиентского кабинета, задействованные цепочкой
# автозадач «клиент молчит после подборки» (см. uonfollowupspec.md §1.2) —
# не полный список 74+ событий U-ON, только те, что мы реально обрабатываем.
_STATUS_CHANGE_TYPE_ID = '16'
_CHAT_MESSAGE_TYPE_ID = '15'
_CHAIN_CLOSE_TYPE_IDS = {'27', '55'}
_TASK_ADDED_TYPE_ID = '34'


class UonSyncTriggerView(APIView):
    """Ручной запуск синхронизации с U-ON — кнопка «Синхронизировать с U-ON» в CRM
    (доступна только руководителю/администратору): напоминания (задачи на канбане)
    плюс данные обращений/клиентов по уже известным нам ID (Lead.uon_ticket_id) — в
    API U-ON нет общего списочного эндпоинта, так что дальше данные обновляются
    либо так — по требованию, либо мгновенно через вебхук (UonWebhookView), либо
    разовым импортом по диапазону ID (management-команда backfill_uon —
    для исторических записей, никогда не привязанных к нашему Lead)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_head(request.user):
            return Response({'detail': 'Недостаточно прав'}, status=403)
        sync_all_uon_reminders.delay()
        sync_all_uon_leads.delay()
        return Response({'detail': 'Синхронизация с U-ON запущена'})


class UonWebhookView(APIView):
    """Приёмник вебхуков U-ON (см. doc_webhooks.php в личном кабинете клиента) —
    U-ON сам вызывает этот URL при создании/изменении заявки, обращения (лида),
    клиента и т.д. (74+ типов событий). Полная таблица type_id нам недоступна,
    поэтому мы не разбираем конкретный тип: любое событие с request_id досинхронизирует
    заявку через /request/{id}.json, с lead_id — обращение через /lead/{id}.json.
    Названия этих полей в реальном payload не подтверждены (нет примеров в доступной
    документации) — это разумное предположение по аналогии с request_id.

    Публичный эндпоинт без сессионной авторизации (U-ON — не залогиненный
    CRM-пользователь). Если задан UON_WEBHOOK_SECRET, требуем его в ?token=
    как минимальную защиту от посторонних запросов; иначе пропускаем всех —
    U-ON пока не подтвердил, поддерживает ли он кастомный токен в самом URL."""

    permission_classes = [AllowAny]

    def post(self, request):
        secret = getattr(settings, 'UON_WEBHOOK_SECRET', '')
        if secret and request.query_params.get('token') != secret:
            return Response({'detail': 'Invalid token'}, status=403)

        # dict(...) — на случай form-urlencoded тела (QueryDict): Celery с JSON-
        # сериализатором не умеет передать QueryDict напрямую в .delay(payload).
        payload = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
        type_id = str(payload.get('type_id', ''))
        request_id = str(payload.get('request_id') or payload.get('r_id') or '')
        lead_id = str(payload.get('lead_id') or payload.get('l_id') or '')
        # U-ON шлёт '0' вместо пустоты, а строка '0' проходит проверку ниже
        request_id = '' if request_id in ('0', '') else request_id
        lead_id = '' if lead_id in ('0', '') else lead_id

        UonWebhookLog.objects.create(payload=payload, type_id=type_id, request_id=request_id or lead_id)

        if request_id:
            sync_uon_request.delay(request_id)
        if lead_id:
            sync_uon_lead.delay(lead_id)

        # Цепочка автозадач «клиент молчит после подборки» (см. uonfollowupspec.md)
        # реагирует на конкретные type_id поверх общего досинхронизирования выше.
        if type_id == _STATUS_CHANGE_TYPE_ID:
            handle_uon_status_change.delay(payload)
        elif type_id == _CHAT_MESSAGE_TYPE_ID:
            handle_uon_client_reply.delay(payload)
        elif type_id in _CHAIN_CLOSE_TYPE_IDS:
            handle_uon_chain_close.delay(payload)
        elif type_id == _TASK_ADDED_TYPE_ID:
            from .tasks import handle_uon_task_added
            handle_uon_task_added.delay(payload)

        return Response({'detail': 'ok'})


class UonRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """Раздел «Заявки в U-ON» (панель на карточке нашей заявки, ТЗ по требованию
    клиента) — read-only зеркало /request. Основная страница «Заявки» в CRM
    по-прежнему работает с собственными Lead-записями, не с этим зеркалом."""

    queryset = UonRequestRecord.objects.all()
    serializer_class = UonRequestRecordSerializer
    permission_classes = [IsAuthenticated]


class UonLeadViewSet(viewsets.ReadOnlyModelViewSet):
    """Раздел «Обращения» в CRM — read-only зеркало обращений (лидов, /lead) из U-ON."""

    queryset = UonLeadRecord.objects.all()
    serializer_class = UonLeadRecordSerializer
    permission_classes = [IsAuthenticated]


class UonClientViewSet(viewsets.ReadOnlyModelViewSet):
    """Раздел «Клиенты» в CRM — собирается из client_*-полей заявок/обращений при
    их синхронизации (в API U-ON нет отдельного /client-эндпоинта)."""

    queryset = UonClient.objects.all()
    serializer_class = UonClientSerializer
    permission_classes = [IsAuthenticated]
