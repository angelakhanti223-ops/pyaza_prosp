from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import is_head

from .models import UonClient, UonDeal, UonRequest
from .serializers import UonClientSerializer, UonDealSerializer, UonRequestSerializer
from .tasks import sync_all_uon_reminders, sync_uon_clients, sync_uon_deals, sync_uon_requests


class UonSyncTriggerView(APIView):
    """Ручной запуск полной синхронизации с U-ON — кнопка «Синхронизировать с U-ON»
    в CRM (доступна только руководителю/администратору): напоминания (задачи на
    канбане), заявки, обращения (сделки) и клиенты — всё зеркало сразу. Обычно
    напоминания и так синхронизируются по расписанию каждые 10 минут (Celery Beat),
    эта кнопка — для случаев, когда нужно подтянуть свежие данные немедленно."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_head(request.user):
            return Response({'detail': 'Недостаточно прав'}, status=403)
        sync_all_uon_reminders.delay()
        sync_uon_requests.delay()
        sync_uon_deals.delay()
        sync_uon_clients.delay()
        return Response({'detail': 'Синхронизация с U-ON запущена'})


class UonRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """Раздел «Заявки» в CRM — read-only зеркало заявок из U-ON."""

    queryset = UonRequest.objects.all()
    serializer_class = UonRequestSerializer
    permission_classes = [IsAuthenticated]


class UonDealViewSet(viewsets.ReadOnlyModelViewSet):
    """Раздел «Обращения» в CRM — read-only зеркало обращений (сделок) из U-ON."""

    queryset = UonDeal.objects.all()
    serializer_class = UonDealSerializer
    permission_classes = [IsAuthenticated]


class UonClientViewSet(viewsets.ReadOnlyModelViewSet):
    """Раздел «Клиенты» в CRM — read-only зеркало клиентов из U-ON."""

    queryset = UonClient.objects.all()
    serializer_class = UonClientSerializer
    permission_classes = [IsAuthenticated]
