import re
from datetime import date

from rest_framework import serializers
from django.urls import reverse
from django.utils import timezone

from .models import Candidate
from .schema import FIELDS, SCHEMA


def validate_fields(data, fields):
    result = {}
    for field in fields:
        key = field['key']
        value = data.get(key, False if field['type'] == 'checkbox' else '')
        if field['type'] == 'checkbox':
            if type(value) is not bool:
                raise serializers.ValidationError(f"Проверьте поле: {field['label']}.")
            result[key] = value
            continue
        if not isinstance(value, str):
            raise serializers.ValidationError(f"Проверьте поле: {field['label']}.")
        value = value.strip()
        if any(ord(c) < 32 and c not in '\n\r\t' for c in value):
            raise serializers.ValidationError('Недопустимые символы в анкете.')
        if field['required'] and not value:
            raise serializers.ValidationError(f"Заполните поле: {field['label']}.")
        if len(value) > (2000 if field['type'] == 'textarea' else 300):
            raise serializers.ValidationError(f"Слишком длинное значение: {field['label']}.")
        if value and field['type'] == 'select' and value not in field['options']:
            raise serializers.ValidationError(f"Выберите значение: {field['label']}.")
        if value and field['type'] == 'email':
            serializers.EmailField().run_validation(value)
        if value and field['type'] == 'tel' and (not re.fullmatch(r'[+0-9() .-]{7,25}', value) or len(re.sub(r'\D', '', value)) < 7):
            raise serializers.ValidationError(f"Проверьте телефон: {field['label']}.")
        if value and field['type'] == 'date':
            try:
                parsed = date.fromisoformat(value)
                if parsed.isoformat() != value or parsed > timezone.localdate():
                    raise ValueError
            except ValueError:
                raise serializers.ValidationError(f"Проверьте дату: {field['label']}.")
        result[key] = value
    return result


class SubmissionSerializer(serializers.Serializer):
    requestId = serializers.UUIDField()
    consent = serializers.BooleanField()
    consentVersion = serializers.CharField(max_length=100)

    def validate(self, attrs):
        raw = self.initial_data
        if raw.get('consent') is not True:
            raise serializers.ValidationError('Подтвердите согласие на обработку персональных данных.')
        if raw.get('website'):
            raise serializers.ValidationError('Не удалось отправить анкету.')
        if attrs['consentVersion'] != SCHEMA['consent_version']:
            raise serializers.ValidationError('Версия согласия изменилась. Обновите страницу.')
        result = validate_fields(raw, FIELDS)
        for key, pattern in {'passportSeries': r'\d{4}', 'passportNumber': r'\d{6}', 'inn': r'\d{12}', 'snils': r'[0-9 -]{11,14}'}.items():
            if result[key] and not re.fullmatch(pattern, result[key]):
                raise serializers.ValidationError('Проверьте реквизиты документов.')
        if result['passportDate'] and result['passportDate'] < result['birthDate']:
            raise serializers.ValidationError('Дата выдачи паспорта раньше даты рождения.')
        if result['sameAddress']:
            for key in ('City', 'Street', 'House', 'Building', 'Flat'):
                result['live' + key] = result['reg' + key]
        for key, parent in {'nameChangeDetails': 'nameChanged', 'previousCompanyWork': 'workedBefore', 'fsspDetails': 'hasFssp', 'loanDetails': 'hasLoans', 'businessName': 'hasBusiness', 'relativesDetails': 'hasRelatives'}.items():
            if not result[parent]:
                result[key] = ''
        jobs = raw.get('jobs', [])
        if not isinstance(jobs, list) or len(jobs) > 5 or any(not isinstance(job, dict) for job in jobs):
            raise serializers.ValidationError('Укажите не более пяти мест работы.')
        result['jobs'] = []
        for job in jobs:
            item = validate_fields(job, SCHEMA['work'])
            if item['current']:
                item['to'] = item['reason'] = ''
            if item['from'] and item['to'] and item['to'] < item['from']:
                raise serializers.ValidationError('Окончание работы раньше её начала.')
            result['jobs'].append(item)
        return {'request_id': attrs['requestId'], 'data': result}


class CandidateSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = Candidate
        fields = ['id', 'full_name', 'phone', 'email', 'position', 'city', 'status', 'status_display', 'notes', 'created_at', 'consent_at', 'consent_version', 'pdf_url']
        read_only_fields = [field for field in fields if field not in ('status', 'notes')]
        extra_kwargs = {'notes': {'max_length': 10000}}

    def get_pdf_url(self, obj):
        return reverse('candidate-pdf', kwargs={'pk': obj.pk})


class CandidateDetailSerializer(CandidateSerializer):
    class Meta(CandidateSerializer.Meta):
        fields = CandidateSerializer.Meta.fields + ['data', 'consent_text', 'consent_sha256']
        read_only_fields = CandidateSerializer.Meta.read_only_fields + ['data', 'consent_text', 'consent_sha256']
