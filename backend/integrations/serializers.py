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
        fields = [
            'id', 'uon_id', 'name', 'surname', 'patronymic', 'name_en', 'surname_en',
            'phone', 'phone_home', 'email', 'sex', 'birthday',
            'passport_number', 'passport_issued_by', 'passport_date',
            'zagran_number', 'zagran_expire', 'address', 'company', 'inn',
            'telegram', 'whatsapp', 'viber', 'social_vk', 'instagram',
            'country', 'city', 'nationality', 'notes', 'is_main_contact', 'synced_at',
        ]
