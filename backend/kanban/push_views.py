from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from pywebpush import WebPushException
from requests import RequestException

from .models import TaskPushReceipt, WebPushSubscription
from .push import SubscriptionSerializer, due_tasks, endpoint_hash, send_push, vapid_identity


class PushConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        response = Response({
            'public_key': vapid_identity().public_key,
            'enabled': WebPushSubscription.objects.filter(user=request.user, session_key=request.session.session_key, is_active=True).exists(),
        })
        response['Cache-Control'] = 'private, no-store'
        return response


class PushSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        if not request.session.session_key:
            return Response({'detail': 'Войдите в CRM заново.'}, status=400)
        defaults = {
            'user': request.user, 'session_key': request.session.session_key, 'endpoint': values['endpoint'],
            'p256dh': values['keys']['p256dh'], 'auth': values['keys']['auth'], 'is_active': True,
        }
        with transaction.atomic():
            subscription, _ = WebPushSubscription.objects.get_or_create(endpoint_hash=endpoint_hash(values['endpoint']), defaults=defaults)
            subscription = WebPushSubscription.objects.select_for_update().get(pk=subscription.pk)
            if subscription.user_id != request.user.pk or subscription.session_key != request.session.session_key or not subscription.is_active:
                TaskPushReceipt.objects.filter(subscription=subscription).delete()
            for field, value in defaults.items():
                setattr(subscription, field, value)
            subscription.save()
        return Response(status=204)

    def delete(self, request):
        endpoint = request.data.get('endpoint', '')
        WebPushSubscription.objects.filter(user=request.user, session_key=request.session.session_key, endpoint_hash=endpoint_hash(endpoint)).update(is_active=False)
        return Response(status=204)


class PushPreviewView(APIView):
    """The service worker must recheck the current account and task state before display."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            ids = [int(value) for value in request.query_params.get('ids', '').split(',') if value][:10]
        except ValueError:
            return Response(status=400)
        tasks = [{'id': task.pk, 'title': task.title, 'deadline': task.deadline.isoformat()} for task in due_tasks(request.user.pk).filter(pk__in=ids)]
        response = Response({'user_id': request.user.pk, 'tasks': tasks})
        response['Cache-Control'] = 'private, no-store'
        return response


class PushTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        subscription = WebPushSubscription.objects.filter(user=request.user, session_key=request.session.session_key, is_active=True).first()
        if not subscription:
            return Response({'detail': 'Сначала включите уведомления в этом браузере.'}, status=400)
        try:
            send_push(subscription, {'user_id': request.user.pk, 'test': True})
        except (WebPushException, RequestException):
            return Response({'detail': 'Push-сервис не принял тест. Проверьте разрешения браузера и попробуйте позже.'}, status=503)
        return Response({'detail': 'Тест передан push-сервису.'})
