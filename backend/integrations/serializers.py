from rest_framework import serializers

from .models import UonClient, UonLeadRecord, UonRequestRecord


class UonRequestRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = UonRequestRecord
        fields = [
            'id', 'uon_id', 'reservation_number', 'client_id', 'client_name', 'client_phone',
            'client_email', 'status_id', 'status_name', 'manager_name', 'source_name', 'notes',
            'is_archive', 'uon_created_at', 'synced_at',
        ]


class UonLeadRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = UonLeadRecord
        fields = [
            'id', 'uon_id', 'client_id', 'client_name', 'client_phone', 'client_email',
            'status_id', 'status_name', 'manager_name', 'source_name', 'notes',
            'is_archive', 'uon_created_at', 'synced_at',
        ]


class UonClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = UonClient
        fields = ['id', 'uon_id', 'name', 'phone', 'email', 'synced_at']
