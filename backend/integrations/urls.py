from django.urls import include, path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register('crm/uon/requests', views.UonRequestViewSet, basename='uon-request')
router.register('crm/uon/clients', views.UonClientViewSet, basename='uon-client')

urlpatterns = [
    path('crm/integrations/uon-sync/', views.UonSyncTriggerView.as_view(), name='uon-sync-trigger'),
    path('integrations/uon/webhook/', views.UonWebhookView.as_view(), name='uon-webhook'),
    path('', include(router.urls)),
]
