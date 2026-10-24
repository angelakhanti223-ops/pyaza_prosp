import base64
import hashlib
import json
from datetime import timedelta
from urllib.parse import urlsplit

import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.conf import settings
from django.contrib.sessions.models import Session
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from pywebpush import WebPushException, webpush
from rest_framework import serializers

from .models import KanbanColumn, Task, TaskPushReceipt, WebPushKey, WebPushSubscription


def vapid_identity():
    identity = WebPushKey.objects.filter(pk=1).first()
    if identity:
        return identity
    key = ec.generate_private_key(ec.SECP256R1())
    private = base64.urlsafe_b64encode(key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())).decode().rstrip('=')
    public = base64.urlsafe_b64encode(key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)).decode().rstrip('=')
    return WebPushKey.objects.get_or_create(pk=1, defaults={'private_key': private, 'public_key': public})[0]


def endpoint_hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


class SubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=2048)
    keys = serializers.DictField(child=serializers.CharField(max_length=128))

    def validate_endpoint(self, value):
        url = urlsplit(value)
        host = url.hostname or ''
        allowed = host in ['fcm.googleapis.com', 'web.push.apple.com', 'updates.push.services.mozilla.com'] or host.endswith(('.push.services.mozilla.com', '.notify.windows.com', '.notify.windows.net'))
        if url.scheme != 'https' or url.username or url.password or url.port not in [None, 443] or not allowed or url.fragment:
            raise serializers.ValidationError('Сервис push этого браузера не поддерживается. Используйте актуальный браузер с Web Push.')
        return value

    def validate_keys(self, value):
        try:
            public = base64.urlsafe_b64decode(value['p256dh'] + '=' * (-len(value['p256dh']) % 4))
            auth = base64.urlsafe_b64decode(value['auth'] + '=' * (-len(value['auth']) % 4))
            ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), public)
            if len(auth) != 16:
                raise ValueError
        except (KeyError, ValueError, TypeError):
            raise serializers.ValidationError('Некорректные ключи подписки.')
        return value


def session_is_active(subscription):
    if not subscription.user.is_active:
        return False
    session = Session.objects.filter(session_key=subscription.session_key, expire_date__gt=timezone.now()).first()
    if not session:
        return False
    data = session.get_decoded()
    return str(data.get('_auth_user_id')) == str(subscription.user_id) and constant_time_compare(data.get('_auth_user_hash', ''), subscription.user.get_session_auth_hash())


def due_tasks(user_id):
    tasks = Task.objects.filter(assignee_id=user_id, deadline__lte=timezone.now()).exclude(status__in=[Task.Status.DONE, Task.Status.CANCELLED])
    return tasks.order_by('deadline', 'pk')


class NoRedirectSession(requests.Session):
    def post(self, *args, **kwargs):
        kwargs['allow_redirects'] = False
        return super().post(*args, **kwargs)


def send_push(subscription, payload):
    identity = vapid_identity()
    with NoRedirectSession() as session:
        return webpush(
            subscription_info={'endpoint': subscription.endpoint, 'keys': {'p256dh': subscription.p256dh, 'auth': subscription.auth}},
            data=json.dumps(payload), vapid_private_key=identity.private_key,
            vapid_claims={'sub': getattr(settings, 'WEB_PUSH_SUBJECT', 'mailto:pnztour@mail.ru')},
            ttl=300, timeout=8, requests_session=session,
        )


def dispatch_due_pushes():
    sent = 0
    for subscription_id in WebPushSubscription.objects.filter(is_active=True).values_list('pk', flat=True):
        with transaction.atomic():
            subscription = WebPushSubscription.objects.select_for_update().select_related('user').get(pk=subscription_id)
            if not subscription.is_active:
                continue
            if not session_is_active(subscription):
                subscription.is_active = False
                subscription.save(update_fields=['is_active'])
                continue
            receipts, entries = [], []
            now = timezone.now()
            for task in due_tasks(subscription.user_id):
                receipt, _ = TaskPushReceipt.objects.get_or_create(subscription=subscription, task=task, deadline=task.deadline)
                if receipt.sent_at or receipt.attempts >= 5 or (receipt.retry_at and receipt.retry_at > now):
                    continue
                receipts.append(receipt)
                entries.append({'id': task.pk, 'deadline': task.deadline.isoformat()})
                if len(entries) == 10:
                    break
            if not entries:
                continue
            try:
                send_push(subscription, {'user_id': subscription.user_id, 'tasks': entries})
            except (WebPushException, requests.RequestException) as error:
                response = getattr(error, 'response', None)
                if response is not None and response.status_code in [404, 410]:
                    subscription.is_active = False
                    subscription.save(update_fields=['is_active'])
                for receipt in receipts:
                    receipt.attempts += 1
                    receipt.retry_at = now + timedelta(minutes=min(30, 2 ** receipt.attempts))
                    receipt.save(update_fields=['attempts', 'retry_at'])
            else:
                for receipt in receipts:
                    receipt.sent_at = now
                    receipt.attempts += 1
                    receipt.save(update_fields=['sent_at', 'attempts'])
                sent += 1
    return sent
