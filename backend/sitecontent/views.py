from rest_framework import generics, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Certificate, SiteImages, TeamMember
from .serializers import (
    CertificateCrmSerializer,
    CertificateSerializer,
    SiteImagesSerializer,
    TeamMemberCrmSerializer,
    TeamMemberSerializer,
)


class SiteImagesView(APIView):
    """Управляемые изображения публичного сайта — редактируются в Django admin."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(SiteImagesSerializer(SiteImages.load(), context={'request': request}).data)


class TeamMemberListView(generics.ListAPIView):
    """Страница «Команда» — публичный список сотрудников."""

    queryset = TeamMember.objects.filter(is_active=True)
    serializer_class = TeamMemberSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class CertificateListView(generics.ListAPIView):
    """Страница «Сертификаты» — публичный список."""

    queryset = Certificate.objects.filter(is_active=True)
    serializer_class = CertificateSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class TeamMemberCrmViewSet(viewsets.ModelViewSet):
    """CRM-раздел «Команда» — полный CRUD, доступен любому залогиненному сотруднику."""

    queryset = TeamMember.objects.all()
    serializer_class = TeamMemberCrmSerializer
    permission_classes = [IsAuthenticated]


class CertificateCrmViewSet(viewsets.ModelViewSet):
    """CRM-раздел «Сертификаты» — полный CRUD, доступен любому залогиненному сотруднику."""

    queryset = Certificate.objects.all()
    serializer_class = CertificateCrmSerializer
    permission_classes = [IsAuthenticated]
