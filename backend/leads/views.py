from django.db.models import Q
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from accounts.permissions import is_head

from .models import Direction, Lead, LeadStatusHistory
from .serializers import (
    DirectionSerializer,
    LeadAttachmentSerializer,
    LeadCommentSerializer,
    LeadCreateSerializer,
    LeadDetailSerializer,
    LeadListSerializer,
    LeadUpdateSerializer,
)


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


class LeadViewSet(viewsets.ModelViewSet):
    """Мини-CRM (ТЗ 5): список/карточка заявки, смена статуса, комментарии, файлы.

    Менеджер видит и ведёт только свои заявки; руководитель/администратор — все
    заявки и может переназначать ответственного (ТЗ 5.3).
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'post', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = (
            Lead.objects.select_related('assigned_manager', 'direction')
            .prefetch_related('comments__author', 'status_history__changed_by', 'attachments__uploaded_by', 'tasks__column')
        )
        if not is_head(user):
            qs = qs.filter(assigned_manager=user)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(phone__icontains=search) | Q(email__icontains=search))

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return LeadListSerializer
        if self.action == 'partial_update':
            return LeadUpdateSerializer
        if self.action == 'add_comment':
            return LeadCommentSerializer
        if self.action == 'add_attachment':
            return LeadAttachmentSerializer
        return LeadDetailSerializer

    def partial_update(self, request, *args, **kwargs):
        lead = self.get_object()
        old_status = lead.status

        serializer = self.get_serializer(lead, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        if 'assigned_manager' in serializer.validated_data and not is_head(request.user):
            raise PermissionDenied('Переназначать ответственного может только руководитель.')

        lead = serializer.save()

        new_status = serializer.validated_data.get('status')
        if new_status and new_status != old_status:
            LeadStatusHistory.objects.create(
                lead=lead, old_status=old_status, new_status=new_status, changed_by=request.user,
            )

        # get_object() ran against a queryset with prefetch_related, so the cached
        # related objects (status_history, comments, ...) are stale after the write above.
        lead.refresh_from_db()
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=['post'], url_path='comments')
    def add_comment(self, request, pk=None):
        lead = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(lead=lead, author=request.user)
        return Response(serializer.data, status=201)

    @action(
        detail=True, methods=['post'], url_path='attachments',
        parser_classes=[MultiPartParser, FormParser],
    )
    def add_attachment(self, request, pk=None):
        lead = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(lead=lead, uploaded_by=request.user)
        return Response(serializer.data, status=201)
