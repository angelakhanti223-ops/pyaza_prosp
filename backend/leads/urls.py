from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views
from .dashboard import DashboardView, PlanView, WorkSummaryView

router = DefaultRouter()
router.register('crm/leads', views.LeadViewSet, basename='crm-lead')

urlpatterns = [
    path('leads/', views.LeadCreateView.as_view(), name='lead-create'),
    path('directions/', views.DirectionListView.as_view(), name='direction-list'),
    path('crm/dashboard/', DashboardView.as_view(), name='crm-dashboard'),
    path('crm/plan/', PlanView.as_view(), name='crm-plan'),
    path('crm/summary/', WorkSummaryView.as_view(), name='crm-work-summary'),
    path('', include(router.urls)),
]
