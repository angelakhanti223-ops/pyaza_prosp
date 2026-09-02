from rest_framework import serializers

from .models import Certificate, SiteImages, TeamMember


class SiteImagesSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteImages
        fields = [
            'hero_background', 'why_us_solo', 'why_us_family', 'why_us_cruise',
            'why_us_excursion', 'why_us_support', 'office_photo',
        ]


class TeamMemberSerializer(serializers.ModelSerializer):
    """Публичное представление — для страницы «Команда»."""

    class Meta:
        model = TeamMember
        fields = ['id', 'name', 'role', 'bio', 'photo', 'phone', 'email']


class TeamMemberCrmSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeamMember
        fields = [
            'id', 'name', 'role', 'bio', 'photo', 'phone', 'email',
            'order', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CertificateSerializer(serializers.ModelSerializer):
    """Публичное представление — для страницы «Сертификаты»."""

    class Meta:
        model = Certificate
        fields = ['id', 'title', 'image', 'description']


class CertificateCrmSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certificate
        fields = ['id', 'title', 'image', 'description', 'order', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
