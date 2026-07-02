from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

from .models import Direction
from .serializers import DirectionSerializer, LeadCreateSerializer


class DirectionListView(generics.ListAPIView):
    """Публичный список направлений для выпадающего списка в форме заявки (ТЗ 3.2)."""

    queryset = Direction.objects.filter(is_active=True)
    serializer_class = DirectionSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class LeadCreateView(generics.CreateAPIView):
    """Приём заявки с публичного сайта (ТЗ 3.2): создаёт Lead со статусом «Новая»."""

    serializer_class = LeadCreateSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'lead_create'
