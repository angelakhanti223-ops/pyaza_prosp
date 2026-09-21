from django.db.models import Q
from rest_framework import generics, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from accounts.permissions import is_head
from telegrambot.tasks import notify_lead_assignment, notify_lead_status_change

from .models import Contact, Direction, Lead, LeadStatusHistory, LeadTag, TourOperator
from .serializers import (
    ContactSerializer,
    DirectionSerializer,
    LeadAttachmentSerializer,
    LeadCommentSerializer,
    LeadCreateSerializer,
    LeadCrmCreateSerializer,
    LeadDetailSerializer,
    LeadListSerializer,
    LeadTagSerializer,
    LeadUpdateSerializer,
    TourOperatorSerializer,
)


class DirectionListView(generics.ListAPIView):
    """Публичный список направлений для выпадающего списка в форме заявки."""

    queryset = Direction.objects.filter(is_active=True)
    serializer_class = DirectionSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class TourOperatorListView(generics.ListAPIView):
    """Справочник туроператоров для CRM."""

    queryset = TourOperator.objects.filter(is_active=True).order_by('brand_name')
    serializer_class = TourOperatorSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None


class LeadTagListView(generics.ListAPIView):
    """Справочник меток заявки для CRM."""

    queryset = LeadTag.objects.filter(is_active=True).order_by('name')
    serializer_class = LeadTagSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None


class ContactListView(generics.ListAPIView):
    """Клиенты / контакты для CRM и будущих рассылок."""

    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = Contact.objects.all()
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(last_name__icontains=search) |
                Q(first_name__icontains=search) |
                Q(middle_name__icontains=search) |
                Q(phone_primary__icontains=search) |
                Q(phone_secondary__icontains=search) |
                Q(email_primary__icontains=search) |
                Q(email_secondary__icontains=search) |
                Q(vk_profile__icontains=search)
            )
        if self.request.query_params.get('email_marketing'):
            qs = qs.exclude(email_primary='').filter(allow_email_marketing=True)
        return qs.order_by('last_name', 'first_name', 'phone_primary')


class LeadCreateView(generics.CreateAPIView):
    """Приём заявки с публичного сайта: создаёт Lead со статусом «Новая»."""

    serializer_class = LeadCreateSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'lead_create'


class LeadViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Мини-CRM: список/карточка заявки, создание вручную, смена статуса, комментарии, файлы."""

    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'post', 'head', 'options']

    def get_queryset(self):
        qs = (
            Lead.objects.select_related('assigned_manager', 'direction', 'tour_operator_ref', 'contact')
            .prefetch_related(
                'tags', 'comments__author', 'status_history__changed_by',
                'attachments__uploaded_by', 'tasks__column', 'uon_sync_logs',
            )
        )

        assigned_manager_id = self.request.query_params.get('assigned_manager')
        if assigned_manager_id:
            qs = qs.filter(assigned_manager_id=assigned_manager_id)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        tag_param = self.request.query_params.get('tag')
        if tag_param:
            qs = qs.filter(tags__id=tag_param)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(phone__icontains=search) |
                Q(email__icontains=search) |
                Q(contact__last_name__icontains=search) |
                Q(contact__first_name__icontains=search) |
                Q(contact__middle_name__icontains=search) |
                Q(contact__phone_primary__icontains=search) |
                Q(contact__phone_secondary__icontains=search) |
                Q(contact__email_primary__icontains=search) |
                Q(contact__email_secondary__icontains=search) |
                Q(contact__vk_profile__icontains=search)
            ).distinct()

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return LeadListSerializer
        if self.action == 'create':
            return LeadCrmCreateSerializer
        if self.action == 'partial_update':
            return LeadUpdateSerializer
        if self.action == 'add_comment':
            return LeadCommentSerializer
        if self.action == 'upsert_contact':
            return ContactSerializer
        if self.action == 'add_attachment':
            return LeadAttachmentSerializer
        return LeadDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lead = serializer.save()
        return Response(LeadDetailSerializer(lead, context=self.get_serializer_context()).data, status=201)

    def partial_update(self, request, *args, **kwargs):
        lead = self.get_object()
        old_status = lead.status
        old_assigned_manager_id = lead.assigned_manager_id

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
            if new_status in (
                Lead.Status.BOOKED, Lead.Status.PREPAID, Lead.Status.PAID,
                Lead.Status.CLOSED_WON, Lead.Status.CLOSED_LOST,
            ):
                notify_lead_status_change.delay(lead.id, new_status)

        if lead.assigned_manager_id and lead.assigned_manager_id != old_assigned_manager_id:
            notify_lead_assignment.delay(lead.id)

        lead.refresh_from_db()
        return Response(LeadDetailSerializer(lead, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], url_path='comments')
    def add_comment(self, request, pk=None):
        lead = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(lead=lead, author=request.user)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['post'], url_path='contact')
    def upsert_contact(self, request, pk=None):
        lead = self.get_object()
        if lead.contact_id:
            serializer = self.get_serializer(lead.contact, data=request.data, partial=True)
        else:
            serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contact = serializer.save()

        lead.contact = contact
        lead.name = contact.full_name or lead.name
        lead.phone = contact.phone_primary or lead.phone
        lead.email = contact.email_primary or lead.email
        lead.preferred_messenger = contact.preferred_contact_method or lead.preferred_messenger
        lead.save(update_fields=['contact', 'name', 'phone', 'email', 'preferred_messenger'])

        lead.refresh_from_db()
        return Response(LeadDetailSerializer(lead, context=self.get_serializer_context()).data)

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

    @action(detail=True, methods=['post'], url_path='create-uon-request')
    def create_uon_request(self, request, pk=None):
        lead = self.get_object()
        if lead.uon_request_id:
            return Response({'detail': 'Заявка уже создана в U-ON.'}, status=400)

        from integrations.adapters import UonAdapterError, build_request_payload, get_uon_adapter
        from integrations.tasks import sync_uon_request

        payload = build_request_payload(lead)
        try:
            result = get_uon_adapter().create_request(payload)
        except UonAdapterError as exc:
            return Response({'detail': f'Не удалось создать заявку в U-ON: {exc}'}, status=502)

        new_id = str(result.get('id'))
        lead.uon_request_id = new_id
        lead.save(update_fields=['uon_request_id'])
        sync_uon_request(new_id)

        return Response(LeadDetailSerializer(lead, context=self.get_serializer_context()).data)
