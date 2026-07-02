from django.utils import timezone
from rest_framework import serializers

from .models import Direction, Lead


class DirectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Direction
        fields = ['id', 'name']


class LeadCreateSerializer(serializers.ModelSerializer):
    consent = serializers.BooleanField(write_only=True)

    class Meta:
        model = Lead
        fields = ['id', 'name', 'phone', 'email', 'direction', 'initial_comment', 'consent']
        read_only_fields = ['id']

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError(
                'Необходимо согласие на обработку персональных данных.'
            )
        return value

    def create(self, validated_data):
        validated_data.pop('consent')
        validated_data['source'] = Lead.Source.SITE_FORM
        validated_data['consent_personal_data_at'] = timezone.now()
        return super().create(validated_data)
