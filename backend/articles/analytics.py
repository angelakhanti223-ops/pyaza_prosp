from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Count, F, Min, Q, Sum
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .models import Article, ArticleReadSession

MAX_ACTIVE_MS = 2 * 60 * 60 * 1000
REPORT_TZ = ZoneInfo('Europe/Moscow')


class ArticleTrackingThrottle(AnonRateThrottle):
    scope = 'article_tracking'
    rate = '120/min'


class ReadEventSerializer(serializers.Serializer):
    view_id = serializers.UUIDField()
    active_ms = serializers.IntegerField(min_value=0, max_value=MAX_ACTIVE_MS)
    kind = serializers.ChoiceField(choices=['start', 'progress', 'end'])


class ArticleReadEventView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []  # Beacons can carry cookies; this anonymous endpoint never uses them.
    parser_classes = [JSONParser]
    throttle_classes = [ArticleTrackingThrottle]

    def post(self, request, slug):
        data = ReadEventSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        article = get_object_or_404(Article, slug=slug, status=Article.Status.PUBLISHED, published_at__lte=timezone.now())
        agent = request.META.get('HTTP_USER_AGENT', '').lower()
        if any(bot in agent for bot in ('googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'baiduspider', 'facebookexternalhit')):
            return Response(status=204)
        values = data.validated_data
        with transaction.atomic():
            session, created = ArticleReadSession.objects.get_or_create(id=values['view_id'], defaults={'article': article})
            session = ArticleReadSession.objects.select_for_update().get(pk=session.pk)
            if session.article_id != article.pk:
                raise serializers.ValidationError({'view_id': 'Событие относится к другой статье.'})
            now = timezone.now()
            # Keep cumulative updates monotonic even when beacon/heartbeat packets arrive out of order.
            # Client values are bounded by server-observed age, with a small allowance for network delay.
            age_ms = max(0, int((now - session.started_at).total_seconds() * 1000))
            session.active_ms = max(session.active_ms, min(values['active_ms'], age_ms + 3000, MAX_ACTIVE_MS))
            session.duration_reported = session.duration_reported or values['kind'] != 'start'
            session.last_seen_at = now
            session.save(update_fields=['active_ms', 'duration_reported', 'last_seen_at'])
            if created:
                Article.objects.filter(pk=article.pk).update(views=F('views') + 1)
        return Response(status=204)


class ReportParamsSerializer(serializers.Serializer):
    start = serializers.DateField(required=False)
    end = serializers.DateField(required=False)
    article_id = serializers.IntegerField(required=False, min_value=1)

    def validate(self, attrs):
        today = timezone.localdate(timezone=REPORT_TZ)
        end = attrs.get('end', today)
        start = attrs.get('start', end - timedelta(days=29))
        if end < start or (end - start).days >= 366:
            raise serializers.ValidationError('Выберите период от 1 до 366 дней.')
        if end > today:
            raise serializers.ValidationError('Конец периода не может быть в будущем.')
        attrs.update(start=start, end=end)
        return attrs


def average_seconds(total_ms, measured):
    return round(total_ms / measured / 1000, 1) if measured else None


def change_percent(current, previous):
    if not previous:
        return 0.0 if not current else None
    return round((current - previous) / previous * 100, 1)


class ArticleAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        params = ReportParamsSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        start = params.validated_data['start']
        end = params.validated_data['end']
        article_id = params.validated_data.get('article_id')
        if article_id is not None:
            get_object_or_404(Article, pk=article_id)
        days = (end - start).days + 1
        begin = datetime.combine(start, time.min, tzinfo=REPORT_TZ)
        finish = datetime.combine(end + timedelta(days=1), time.min, tzinfo=REPORT_TZ)
        previous_begin = begin - timedelta(days=days)
        current = Q(read_sessions__started_at__gte=begin, read_sessions__started_at__lt=finish)
        previous = Q(read_sessions__started_at__gte=previous_begin, read_sessions__started_at__lt=begin)
        measured = current & Q(read_sessions__duration_reported=True)
        rows = Article.objects.annotate(
            period_views=Count('read_sessions', filter=current),
            previous_views=Count('read_sessions', filter=previous),
            measured_views=Count('read_sessions', filter=measured),
            active_time_ms=Sum('read_sessions__active_ms', filter=measured),
        ).order_by('-period_views', 'title', 'pk')
        article_rows = []
        selected = []
        for article in rows:
            item = {
                'id': article.pk, 'title': article.title, 'slug': article.slug, 'status': article.status,
                'all_time_views': article.views, 'views': article.period_views,
                'previous_views': article.previous_views, 'measured_views': article.measured_views,
                'avg_seconds': average_seconds(article.active_time_ms or 0, article.measured_views),
                'change_percent': change_percent(article.period_views, article.previous_views),
            }
            article_rows.append(item)
            if article_id is None or article.pk == article_id:
                selected.append((article, item))
        views = sum(item['views'] for _, item in selected)
        previous_views = sum(item['previous_views'] for _, item in selected)
        measured_views = sum(item['measured_views'] for _, item in selected)
        total_ms = sum(article.active_time_ms or 0 for article, _ in selected)
        sessions = ArticleReadSession.objects.all()
        if article_id is not None:
            sessions = sessions.filter(article_id=article_id)
        first_recorded = sessions.aggregate(first=Min('started_at'))['first']
        daily_rows = sessions.filter(started_at__gte=begin, started_at__lt=finish).annotate(
            day=TruncDate('started_at', tzinfo=REPORT_TZ),
        ).values('day').annotate(
            views=Count('id'), measured_views=Count('id', filter=Q(duration_reported=True)),
            active_time_ms=Sum('active_ms', filter=Q(duration_reported=True)),
        )
        by_day = {row['day']: row for row in daily_rows}
        daily = []
        for offset in range(days):
            day = start + timedelta(days=offset)
            row = by_day.get(day, {})
            samples = row.get('measured_views', 0)
            daily.append({
                'date': day.isoformat(), 'views': row.get('views', 0), 'measured_views': samples,
                'avg_seconds': average_seconds(row.get('active_time_ms') or 0, samples),
            })
        response = Response({
            'period': {'start': start, 'end': end, 'previous_start': start - timedelta(days=days), 'previous_end': start - timedelta(days=1), 'timezone': 'Europe/Moscow'},
            'generated_at': timezone.now(), 'first_recorded_at': first_recorded,
            'totals': {'views': views, 'previous_views': previous_views, 'change_percent': change_percent(views, previous_views),
                       'measured_views': measured_views, 'avg_seconds': average_seconds(total_ms, measured_views),
                       'all_time_views': sum(item['all_time_views'] for _, item in selected)},
            'daily': daily, 'articles': article_rows,
        })
        response['Cache-Control'] = 'private, no-store'
        return response
