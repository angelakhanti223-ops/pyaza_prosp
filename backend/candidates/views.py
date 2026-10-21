import hashlib

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.http import content_disposition_header
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics, status
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .models import Candidate
from .pdf import create_candidate_pdf
from .permissions import IsCandidateAdmin
from .schema import SCHEMA
from .serializers import CandidateDetailSerializer, CandidateSerializer, SubmissionSerializer


class SubmissionThrottle(AnonRateThrottle):
    rate = '10/hour'


@method_decorator(never_cache, name='dispatch')
class CandidateSubmissionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [SubmissionThrottle]
    parser_classes = [JSONParser]

    def post(self, request):
        serializer = SubmissionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'detail': ' '.join(str(error) for errors in serializer.errors.values() for error in errors)}, status=400)
        payload = serializer.validated_data
        existing = Candidate.objects.filter(request_id=payload['request_id']).defer('pdf_content').first()
        if existing:
            return self.receipt(existing, payload['data'])
        now = timezone.now()
        data = payload['data']
        candidate = Candidate(
            request_id=payload['request_id'], data=data,
            full_name=' '.join(data[key] for key in ('lastName', 'firstName', 'middleName') if data[key]),
            phone=data['phone'], email=data['email'], position=data['position'], city=data['jobCity'],
            consent_version=SCHEMA['consent_version'], consent_text=SCHEMA['consent_text'],
            consent_sha256=hashlib.sha256(SCHEMA['consent_text'].encode()).hexdigest(),
            consent_at=now, created_at=now,
        )
        candidate.pdf_content = create_candidate_pdf(candidate)
        try:
            with transaction.atomic():
                candidate.save(force_insert=True)
        except IntegrityError:
            existing = Candidate.objects.filter(request_id=payload['request_id']).defer('pdf_content').first()
            if existing is None:
                raise
            return self.receipt(existing, data)
        return self.receipt(candidate, data, created=True)

    @staticmethod
    def receipt(candidate, data, created=False):
        if candidate.data != data:
            return Response({'detail': 'Этот номер отправки уже использован для другой версии анкеты. Обратитесь к администратору.'}, status=409)
        # A public response contains no personal data, PDF URL, or CRM URL.
        return Response({'ok': True, 'id': str(candidate.id)}, status=201 if created else 200)


class AdminCandidateMixin:
    permission_classes = [IsCandidateAdmin]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        response['X-Robots-Tag'] = 'noindex, nofollow'
        return response

    def get_queryset(self):
        return Candidate.objects.defer('pdf_content').all()


class CandidateListView(AdminCandidateMixin, generics.ListAPIView):
    serializer_class = CandidateSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()[:300]
        status_value = self.request.query_params.get('status', '')
        if search:
            queryset = queryset.filter(Q(full_name__icontains=search) | Q(phone__icontains=search) | Q(city__icontains=search) | Q(position__icontains=search))
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset


class CandidateDetailView(AdminCandidateMixin, generics.RetrieveUpdateAPIView):
    serializer_class = CandidateDetailSerializer
    http_method_names = ['get', 'patch', 'head', 'options']


class CandidatePdfView(AdminCandidateMixin, generics.GenericAPIView):
    def get(self, request, *args, **kwargs):
        candidate = self.get_object()
        response = HttpResponse(bytes(candidate.pdf_content), content_type='application/pdf')
        response['Content-Disposition'] = content_disposition_header(request.query_params.get('download') == '1', f'Анкета_{candidate.full_name}_{candidate.id}.pdf')
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'self'"
        return response
