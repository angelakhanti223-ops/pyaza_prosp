from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import is_head

from .tasks import sync_all_uon_reminders


class UonSyncTriggerView(APIView):
    """Ручной запуск синхронизации напоминаний U-ON — кнопка «Синхронизировать с U-ON»
    в CRM (доступна только руководителю/администратору). Обычно синхронизация и так
    идёт по расписанию каждые 10 минут (Celery Beat), эта кнопка — для случаев,
    когда нужно подтянуть свежие данные немедленно, не дожидаясь расписания."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_head(request.user):
            return Response({'detail': 'Недостаточно прав'}, status=403)
        sync_all_uon_reminders.delay()
        return Response({'detail': 'Синхронизация с U-ON запущена'})
