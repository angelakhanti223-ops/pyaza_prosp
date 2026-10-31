from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .management_dashboard import can_view_management, money, period_bounds
from .models import OfficeGoals


class OfficeGoalsUpdateSerializer(serializers.Serializer):
    activity_id = serializers.CharField(max_length=80, required=False)
    completed = serializers.BooleanField(required=False)
    commission_receipts_actual = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal('0'), allow_null=True, required=False,
    )

    def validate(self, attrs):
        if ('activity_id' in attrs) != ('completed' in attrs):
            raise serializers.ValidationError('Укажите цель и её отметку вместе.')
        if not attrs:
            raise serializers.ValidationError('Не указаны изменения.')
        return attrs


class OfficeGoalsView(APIView):
    permission_classes = [IsAuthenticated]

    def _period(self, request):
        if not can_view_management(request.user):
            raise serializers.ValidationError('Недостаточно прав')
        today = timezone.localdate()
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        if year is None and month is None:
            year, month = today.year, today.month
        try:
            period_bounds('custom_month', year=year, month=month)
            year, month = int(year), int(month)
        except (ValueError, TypeError, OverflowError):
            raise serializers.ValidationError('Укажите корректные год и месяц вместе.')
        return year, month

    def get(self, request):
        if not can_view_management(request.user):
            return Response({'detail': 'Недостаточно прав'}, status=403)
        year, month = self._period(request)
        goals = OfficeGoals.objects.filter(year=year, month=month).first()
        if goals is None:
            return Response({'detail': 'Цели на этот месяц не заданы.'}, status=404)
        return Response({
            'year': goals.year, 'month': goals.month,
            'commission_basis': goals.commission_basis,
            'targets': {
                'turnover': money(goals.turnover_target),
                'receipts': money(goals.commission_receipts_target),
                'leads': goals.leads_target,
                'conversion': money(goals.conversion_target),
                'commissionRate': money(goals.commission_rate_target) if goals.commission_rate_target is not None else None,
                'russianExpress': money(goals.russian_express_target) if goals.russian_express_target is not None else None,
                'resortSpace': money(goals.resort_space_target) if goals.resort_space_target is not None else None,
                'articles': goals.articles_target,
            },
            'commission_receipts_actual': (
                money(goals.commission_receipts_actual) if goals.commission_receipts_actual is not None else None
            ),
            'activities': goals.activities,
        })

    def patch(self, request):
        if not can_view_management(request.user):
            return Response({'detail': 'Недостаточно прав'}, status=403)
        year, month = self._period(request)
        serializer = OfficeGoalsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        with transaction.atomic():
            goals = OfficeGoals.objects.select_for_update().filter(year=year, month=month).first()
            if goals is None:
                return Response({'detail': 'Цели на этот месяц не заданы.'}, status=404)
            fields = []
            if 'activity_id' in values:
                activities = [dict(item) for item in goals.activities]
                matches = [item for item in activities if item.get('id') == values['activity_id']]
                if len(matches) != 1:
                    return Response({'detail': 'Цель не найдена.'}, status=400)
                matches[0]['completed'] = values['completed']
                goals.activities = activities
                fields.append('activities')
            if 'commission_receipts_actual' in values:
                if goals.commission_basis != 'cash_receipts':
                    return Response({'detail': 'У этого плана комиссия считается по бронированиям.'}, status=400)
                goals.commission_receipts_actual = values['commission_receipts_actual']
                fields.append('commission_receipts_actual')
            goals.save(update_fields=fields)
        return self.get(request)
