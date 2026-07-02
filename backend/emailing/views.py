import base64
from urllib.parse import urlparse

from django.conf import settings
from django.http import Http404, HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

from .models import EmailSend, EmailSubscriber
from .serializers import SubscribeSerializer

# Standard 1x1 transparent GIF, used as an email open-tracking pixel.
_TRACKING_PIXEL = base64.b64decode('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==')


class SubscribeView(generics.CreateAPIView):
    """Подписка на email-рассылку с сайта (ТЗ 3.1, 9.2)."""

    serializer_class = SubscribeSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'subscribe'


def track_open(request, token):
    """Пиксель открытия письма кампании (ТЗ 9.2 — статистика открытий)."""
    EmailSend.objects.filter(tracking_token=token, opened_at__isnull=True).update(opened_at=timezone.now())
    return HttpResponse(_TRACKING_PIXEL, content_type='image/gif')


def track_click(request, token):
    """Редирект по ссылке из письма кампании с фиксацией перехода (ТЗ 9.2 — статистика переходов).

    Требует существующий токен (иначе 404) и ограничивает редирект собственными
    доменами — без этого эндпоинт превращается в открытый редиректор для фишинга.
    """
    send = EmailSend.objects.filter(tracking_token=token).first()
    if send is None:
        raise Http404

    if send.clicked_at is None:
        send.clicked_at = timezone.now()
        send.save(update_fields=['clicked_at'])

    allowed_hosts = {urlparse(settings.SITE_URL).netloc, urlparse(settings.BACKEND_URL).netloc}
    target = request.GET.get('url') or settings.SITE_URL
    if not url_has_allowed_host_and_scheme(target, allowed_hosts=allowed_hosts, require_https=not settings.DEBUG):
        target = settings.SITE_URL

    return HttpResponseRedirect(target)


def unsubscribe(request, token):
    """Одна ссылка — мгновенная отписка без входа в систему (обязательное требование ТЗ 9.2, 152-ФЗ)."""
    subscriber = EmailSubscriber.objects.filter(unsubscribe_token=token).first()
    already = True
    if subscriber and subscriber.is_active:
        subscriber.is_active = False
        subscriber.unsubscribed_at = timezone.now()
        subscriber.save(update_fields=['is_active', 'unsubscribed_at'])
        already = False
    return render(request, 'emailing/unsubscribed.html', {'already': already})
