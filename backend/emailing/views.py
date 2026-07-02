from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

from .serializers import SubscribeSerializer


class SubscribeView(generics.CreateAPIView):
    """Подписка на email-рассылку с сайта (ТЗ 3.1, 9.2)."""

    serializer_class = SubscribeSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'subscribe'
