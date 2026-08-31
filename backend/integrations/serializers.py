from rest_framework import serializers

from .models import UonClient, UonLeadRecord, UonRequestRecord


class UonRequestPushUpdateSerializer(serializers.Serializer):
    """Вход для UonRequestViewSet.push_update — поля, которые реально
    поддерживает POST /request/update/{id}.json (см. adapters.RealUonAdapter.
    update_request): статус и ответственный — это ID из справочников U-ON
    (/status, /manager), не свободный текст."""

    status_id = serializers.CharField(required=False, allow_blank=False)
    manager_id = serializers.CharField(required=False, allow_blank=False)
    reservation_number = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError('Нужно передать хотя бы одно поле для обновления.')
        return attrs


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
