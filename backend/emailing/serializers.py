from django.utils import timezone
from rest_framework import serializers

from .models import EmailSubscriber


class SubscribeSerializer(serializers.ModelSerializer):
    consent = serializers.BooleanField(write_only=True)

    class Meta:
        model = EmailSubscriber
        fields = ['id', 'email', 'name', 'consent']
        read_only_fields = ['id']

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError(
                'Необходимо согласие на получение рассылки.'
            )
        return value

    def create(self, validated_data):
        validated_data.pop('consent')
        email = validated_data['email']
        subscriber, _ = EmailSubscriber.objects.update_or_create(
            email=email,
            defaults={
                'name': validated_data.get('name', ''),
                'is_active': True,
                'consented_at': timezone.now(),
                'unsubscribed_at': None,
            },
        )
        return subscriber
