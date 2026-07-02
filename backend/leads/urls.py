from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('crm/leads', views.LeadViewSet, basename='crm-lead')

urlpatterns = [
    path('leads/', views.LeadCreateView.as_view(), name='lead-create'),
    path('directions/', views.DirectionListView.as_view(), name='direction-list'),
    path('', include(router.urls)),
]
