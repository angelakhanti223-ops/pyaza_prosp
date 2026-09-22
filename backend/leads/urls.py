from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views
from .dashboard import DashboardView, PlanView, WorkScheduleView, WorkSummaryView
from .management_dashboard import ManagementDashboardView

router = DefaultRouter()
router.register('crm/leads', views.LeadViewSet, basename='crm-lead')

urlpatterns = [
    path('leads/', views.LeadCreateView.as_view(), name='lead-create'),
    path('directions/', views.DirectionListView.as_view(), name='direction-list'),
    path('crm/tour-operators/', views.TourOperatorListView.as_view(), name='crm-tour-operators'),
    path('crm/lead-tags/', views.LeadTagListView.as_view(), name='crm-lead-tags'),
    path('crm/contacts/', views.ContactListView.as_view(), name='crm-contacts'),
    path('crm/dashboard/', DashboardView.as_view(), name='crm-dashboard'),
    path('crm/management-dashboard/', ManagementDashboardView.as_view(), name='crm-management-dashboard'),
    path('crm/plan/', PlanView.as_view(), name='crm-plan'),
    path('crm/summary/', WorkSummaryView.as_view(), name='crm-work-summary'),
    path('crm/work-schedule/', WorkScheduleView.as_view(), name='crm-work-schedule'),
    path('', include(router.urls)),
]
