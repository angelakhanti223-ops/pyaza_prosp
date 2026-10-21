from django.urls import path

from .views import CandidateDetailView, CandidateListView, CandidatePdfView, CandidateSubmissionView

urlpatterns = [
    path('candidates/submit/', CandidateSubmissionView.as_view(), name='candidate-submit'),
    path('crm/candidates/', CandidateListView.as_view(), name='candidate-list'),
    path('crm/candidates/<uuid:pk>/', CandidateDetailView.as_view(), name='candidate-detail'),
    path('crm/candidates/<uuid:pk>/pdf/', CandidatePdfView.as_view(), name='candidate-pdf'),
]
