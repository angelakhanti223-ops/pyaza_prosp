from django.conf import settings
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import is_head

from .models import UonClient, UonRequestRecord, UonWebhookLog
from .serializers import UonClientSerializer, UonRequestRecordSerializer
from .tasks import sync_all_uon_reminders, sync_all_uon_requests, sync_uon_request


class UonSyncTriggerView(APIView):
    """Ручной запуск синхронизации с U-ON — кнопка «Синхронизировать с U-ON» в CRM
    (доступна только руководителю/администратору): напоминания (задачи на канбане)
    плюс данные заявок/клиентов по уже известным нам ID (Lead.uon_ticket_id) — в API
    U-ON нет общего списочного эндпоинта, так что дальше данные обновляются либо
    так — по требованию, либо мгновенно через вебхук (UonWebhookView)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_head(request.user):
            return Response({'detail': 'Недостаточно прав'}, status=403)
        sync_all_uon_reminders.delay()
        sync_all_uon_requests.delay()
        return Response({'detail': 'Синхронизация с U-ON запущена'})


class UonWebhookView(APIView):
    """Приёмник вебхуков U-ON (см. doc_webhooks.php в личном кабинете клиента) —
    U-ON сам вызывает этот URL при создании/изменении заявки, клиента, статуса
    и т.д. (74+ типов событий). Полная таблица type_id нам недоступна, поэтому мы
    не разбираем конкретный тип: любое событие с request_id просто запускает
    досинхронизацию этой заявки через уже подтверждённый /request/{id}.json.

    Публичный эндпоинт без сессионной авторизации (U-ON — не залогиненный
    CRM-пользователь). Если задан UON_WEBHOOK_SECRET, требуем его в ?token=
    как минимальную защиту от посторонних запросов; иначе пропускаем всех —
    U-ON пока не подтвердил, поддерживает ли он кастомный токен в самом URL."""

    permission_classes = [AllowAny]

    def post(self, request):
        secret = getattr(settings, 'UON_WEBHOOK_SECRET', '')
        if secret and request.query_params.get('token') != secret:
            return Response({'detail': 'Invalid token'}, status=403)

        payload = request.data
        type_id = str(payload.get('type_id', ''))
        request_id = str(payload.get('request_id') or payload.get('r_id') or '')

        UonWebhookLog.objects.create(payload=payload, type_id=type_id, request_id=request_id)

        if request_id:
            sync_uon_request.delay(request_id)

        return Response({'detail': 'ok'})


class UonRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only зеркало заявок из U-ON — используется и разделом «Заявки», и
    разделом «Обращения» (последний фильтрует ?is_archive=1, единственное
    подтверждённое поле, по которому можно разделить активные/архивные заявки,
    пока не известна полная таблица статусов U-ON)."""

    queryset = UonRequestRecord.objects.all()
    serializer_class = UonRequestRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        is_archive = self.request.query_params.get('is_archive')
        if is_archive is not None:
            qs = qs.filter(is_archive=is_archive in ('1', 'true', 'True'))
        return qs


class UonClientViewSet(viewsets.ReadOnlyModelViewSet):
    """Раздел «Клиенты» в CRM — собирается из client_*-полей заявок при их
    синхронизации (в API U-ON нет отдельного /client-эндпоинта)."""

    queryset = UonClient.objects.all()
    serializer_class = UonClientSerializer
    permission_classes = [IsAuthenticated]
