from rest_framework import serializers

from .models import SiteImages


class SiteImagesSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteImages
        fields = [
            'hero_background', 'why_us_solo', 'why_us_family', 'why_us_cruise',
            'why_us_excursion', 'why_us_support', 'office_photo',
        ]
