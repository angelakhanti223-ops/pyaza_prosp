import re
from datetime import datetime, time, timedelta

from django.db import transaction
from django.db.models import Count, Max, Min, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import serializers
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .analytics import MAX_ACTIVE_MS, REPORT_TZ, ReadEventSerializer, ReportParamsSerializer, average_seconds, change_percent
from .models import Article, PageReadSession

# Positive catalogue: internal routes can never enter the metric table through the API.
# Keep this in sync with the public App Router pages and public/page-read-tracker.js.
PUBLIC_PAGES = {
    '/': 'Главная',
    '/tours': 'Туры и путёвки',
    '/tours/china-constructor': 'Конструктор тура в Китай',
    '/tours/russia-january-2027': 'Туры по России · январь 2027',
    '/tours/china-2026': 'Туры в Китай · 2026',
    '/tours/china-november-2026': 'Китай · ноябрь 2026',
    '/tours/shanghai-beijing-constructor': 'Конструктор Шанхай — Пекин',
    '/directions': 'Направления',
    '/cruises': 'Круизы',
    '/promotions': 'Акции',
    '/blog': 'Блог',
    '/blog/kakie-gory-i-sklon-vam-podoydut': 'Какие горы и склон вам подойдут',
    '/middle-east': 'Ближний Восток',
    '/about': 'О нас',
    '/team': 'Команда',
    '/certificates': 'Сертификаты',
    '/contacts': 'Контакты',
    '/privacy': 'Политика конфиденциальности',
    '/terms': 'Пользовательское соглашение',
}
ALIASES = {'/china-tour-builder.html': '/tours/china-constructor'}
BLOG_PATH = re.compile(r'^/blog/([a-zA-Z0-9_-]{1,255})$')


def canonical_path(value):
    # Discard marketing/search/fragment values before persistence, even on a forged request.
    path = value.split('?', 1)[0].split('#', 1)[0]
    path = path.rstrip('/') or '/'
    return ALIASES.get(path, path)


def allowed_shape(path):
    return path in PUBLIC_PAGES or bool(BLOG_PATH.fullmatch(path))


def public_title(path):
    if path in PUBLIC_PAGES:
        return PUBLIC_PAGES[path]
    match = BLOG_PATH.fullmatch(path)
    if match:
        return Article.objects.filter(slug=match[1], status=Article.Status.PUBLISHED, published_at__lte=timezone.now()).values_list('title', flat=True).first()
    return None


class PageTrackingThrottle(AnonRateThrottle):
    scope = 'page_tracking'
    rate = '240/min'


class PageReadEventSerializer(ReadEventSerializer):
    path = serializers.CharField(max_length=1024, trim_whitespace=False)

    def validate_path(self, value):
        path = canonical_path(value)
        if not allowed_shape(path):
            raise serializers.ValidationError('Страница не входит в публичную часть сайта.')
        return path


class PageReadEventView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = [JSONParser]
    throttle_classes = [PageTrackingThrottle]

    def post(self, request):
        serializer = PageReadEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        title = public_title(values['path'])
        if title is None:
            return Response(status=404)
        agent = request.META.get('HTTP_USER_AGENT', '').lower()
        if any(bot in agent for bot in ('googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'baiduspider', 'facebookexternalhit')):
            return Response(status=204)
        with transaction.atomic():
            session, _ = PageReadSession.objects.get_or_create(id=values['view_id'], defaults={'path': values['path'], 'title': title})
            session = PageReadSession.objects.select_for_update().get(pk=session.pk)
            if session.path != values['path']:
                raise serializers.ValidationError({'view_id': 'Событие относится к другой странице.'})
            now = timezone.now()
            age_ms = max(0, int((now - session.started_at).total_seconds() * 1000))
            session.active_ms = max(session.active_ms, min(values['active_ms'], age_ms + 3000, MAX_ACTIVE_MS))
            session.duration_reported = session.duration_reported or values['kind'] != 'start'
            session.last_seen_at = now
            session.save(update_fields=['active_ms', 'duration_reported', 'last_seen_at'])
        return Response(status=204)


class PageReportParamsSerializer(ReportParamsSerializer):
    path = serializers.CharField(required=False, max_length=512)

    def validate_path(self, value):
        path = canonical_path(value)
        if not allowed_shape(path):
            raise serializers.ValidationError('Страница не входит в публичную часть сайта.')
        return path


class PageAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        params = PageReportParamsSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        start, end = params.validated_data['start'], params.validated_data['end']
        path = params.validated_data.get('path')
        days = (end - start).days + 1
        begin = datetime.combine(start, time.min, tzinfo=REPORT_TZ)
        finish = datetime.combine(end + timedelta(days=1), time.min, tzinfo=REPORT_TZ)
        previous_begin = begin - timedelta(days=days)
        current = Q(started_at__gte=begin, started_at__lt=finish)
        previous = Q(started_at__gte=previous_begin, started_at__lt=begin)
        measured = current & Q(duration_reported=True)
        catalogue = dict(PUBLIC_PAGES)
        catalogue.update({f'/blog/{slug}': title for slug, title in Article.objects.filter(status=Article.Status.PUBLISHED, published_at__lte=timezone.now()).values_list('slug', 'title')})
        grouped = PageReadSession.objects.values('path').annotate(
            stored_title=Max('title'), all_time_views=Count('id'), first=Min('started_at'),
            views=Count('id', filter=current), previous_views=Count('id', filter=previous),
            measured_views=Count('id', filter=measured), active_time_ms=Sum('active_ms', filter=measured),
        )
        # Retain historical public article pages even if they have since been archived/deleted.
        by_path = {row['path']: row for row in grouped if allowed_shape(row['path'])}
        for stored_path, row in by_path.items():
            catalogue.setdefault(stored_path, row['stored_title'])
        if path is not None and path not in catalogue:
            return Response(status=404)
        rows, selected = [], []
        for item_path, title in catalogue.items():
            row = by_path.get(item_path, {})
            samples = row.get('measured_views', 0)
            item = {
                'path': item_path, 'title': title, 'views': row.get('views', 0),
                'previous_views': row.get('previous_views', 0), 'measured_views': samples,
                'all_time_views': row.get('all_time_views', 0),
                'avg_seconds': average_seconds(row.get('active_time_ms') or 0, samples),
                'change_percent': change_percent(row.get('views', 0), row.get('previous_views', 0)),
            }
            rows.append(item)
            if path is None or path == item_path:
                selected.append((item, row))
        rows.sort(key=lambda row: (-row['views'], row['title'], row['path']))
        views = sum(item['views'] for item, _ in selected)
        previous_views = sum(item['previous_views'] for item, _ in selected)
        measured_views = sum(item['measured_views'] for item, _ in selected)
        total_ms = sum(row.get('active_time_ms') or 0 for _, row in selected)
        recorded = [row['first'] for _, row in selected if row.get('first')]
        sessions = PageReadSession.objects.filter(path__in=[item['path'] for item, _ in selected])
        daily_rows = sessions.filter(started_at__gte=begin, started_at__lt=finish).annotate(day=TruncDate('started_at', tzinfo=REPORT_TZ)).values('day').annotate(
            views=Count('id'), measured_views=Count('id', filter=Q(duration_reported=True)),
            active_time_ms=Sum('active_ms', filter=Q(duration_reported=True)),
        )
        by_day = {row['day']: row for row in daily_rows}
        daily = []
        for offset in range(days):
            day = start + timedelta(days=offset)
            row = by_day.get(day, {})
            samples = row.get('measured_views', 0)
            daily.append({'date': day.isoformat(), 'views': row.get('views', 0), 'measured_views': samples, 'avg_seconds': average_seconds(row.get('active_time_ms') or 0, samples)})
        response = Response({
            'period': {'start': start, 'end': end, 'previous_start': start - timedelta(days=days), 'previous_end': start - timedelta(days=1), 'timezone': 'Europe/Moscow'},
            'generated_at': timezone.now(), 'first_recorded_at': min(recorded) if recorded else None,
            'totals': {'views': views, 'previous_views': previous_views, 'change_percent': change_percent(views, previous_views), 'measured_views': measured_views,
                       'avg_seconds': average_seconds(total_ms, measured_views), 'all_time_views': sum(item['all_time_views'] for item, _ in selected)},
            'daily': daily, 'pages': rows,
        })
        response['Cache-Control'] = 'private, no-store'
        return response
