from django.urls import path

from . import views

urlpatterns = [
    path('crm/integrations/uon-sync/', views.UonSyncTriggerView.as_view(), name='uon-sync-trigger'),
]
