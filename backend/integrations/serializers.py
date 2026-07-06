from rest_framework import serializers

from .models import UonClient, UonDeal, UonRequest


class UonRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = UonRequest
        fields = [
            'id', 'uon_id', 'name', 'phone', 'email', 'status_name', 'manager_name',
            'source_name', 'comment', 'uon_created_at', 'synced_at',
        ]


class UonDealSerializer(serializers.ModelSerializer):
    class Meta:
        model = UonDeal
        fields = [
            'id', 'uon_id', 'name', 'status_name', 'manager_name', 'amount',
            'request_uon_id', 'uon_created_at', 'synced_at',
        ]


class UonClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = UonClient
        fields = ['id', 'uon_id', 'name', 'phone', 'email', 'uon_created_at', 'synced_at']
