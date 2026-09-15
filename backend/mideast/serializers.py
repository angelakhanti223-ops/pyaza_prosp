from rest_framework import serializers

from .models import Airline, Country, DatasetMeta, Hotel, RixosDossier, Webinar


class WebinarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webinar
        fields = ['number', 'title', 'url', 'src', 'presentation']


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = [
            'id', 'name', 'capital', 'visa', 'currency', 'language', 'flight', 'season',
            'alcohol', 'dress_code', 'transport', 'safety', 'geography', 'emirates',
            'highlights', 'events', 'activities', 'selling_points', 'news', 'practical',
            'webinar_numbers', 'presentations',
        ]


class AirlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Airline
        fields = [
            'id', 'name', 'country', 'hub', 'routes_from_russia', 'network', 'fleet',
            'classes', 'baggage', 'loyalty', 'stopover', 'lounges', 'onboard', 'notes',
            'webinar_numbers', 'presentations',
        ]


class HotelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hotel
        fields = [
            'id', 'name', 'brand', 'brand_group', 'country', 'region', 'location', 'category',
            'status', 'rooms', 'room_min', 'room_types', 'meals', 'beach', 'pools', 'kids',
            'spa', 'restaurants', 'deposit', 'transfer', 'russian_staff', 'news', 'best_for',
            'not_for', 'usp', 'details', 'webinar_numbers', 'presentations',
            'f_all_inclusive', 'f_kids_friendly', 'f_beach', 'f_spa', 'f_russian_staff',
            'f_has_presentation', 'status_flag', 'photo',
        ]


class RixosDossierSerializer(serializers.ModelSerializer):
    class Meta:
        model = RixosDossier
        fields = [
            'title', 'brand_overview', 'concepts', 'kids_programs', 'entertainment',
            'hotels_list', 'selling_points', 'news',
        ]


class DatasetMetaSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatasetMeta
        fields = ['built', 'source', 'presentations_count', 'note']
