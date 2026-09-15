from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Airline, Country, DatasetMeta, Hotel, RixosDossier, Webinar
from .serializers import (
    AirlineSerializer,
    CountrySerializer,
    DatasetMetaSerializer,
    HotelSerializer,
    RixosDossierSerializer,
    WebinarSerializer,
)


class HotelListView(generics.ListAPIView):
    """Публичная база отелей Ближнего Востока — вкладка «Отели» (ТЗ по
    требованию клиента, 15.09.2026, взамен самодостаточного HTML-файла)."""

    queryset = Hotel.objects.all()
    serializer_class = HotelSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class CountryListView(generics.ListAPIView):
    queryset = Country.objects.all()
    serializer_class = CountrySerializer
    permission_classes = [AllowAny]
    pagination_class = None


class AirlineListView(generics.ListAPIView):
    queryset = Airline.objects.all()
    serializer_class = AirlineSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class WebinarListView(generics.ListAPIView):
    queryset = Webinar.objects.all()
    serializer_class = WebinarSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class MideastMetaView(APIView):
    """Досье Rixos + информация об источнике базы — одним запросом, обе почти
    статичные синглтон-записи для подвала/спецблока страницы."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'rixos': RixosDossierSerializer(RixosDossier.load()).data,
            'dataset': DatasetMetaSerializer(DatasetMeta.load()).data,
        })
