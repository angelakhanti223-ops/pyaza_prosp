from django.urls import include, path
from rest_framework.routers import SimpleRouter

from . import views
from .push_views import PushConfigView, PushPreviewView, PushSubscriptionView, PushTestView

router = SimpleRouter()
router.register('crm/kanban/tasks', views.TaskViewSet, basename='crm-kanban-task')

urlpatterns = [
    path('crm/task-push/config/', PushConfigView.as_view()),
    path('crm/task-push/subscription/', PushSubscriptionView.as_view()),
    path('crm/task-push/preview/', PushPreviewView.as_view()),
    path('crm/task-push/test/', PushTestView.as_view()),
    path('crm/kanban/columns/', views.KanbanColumnListView.as_view(), name='kanban-column-list'),
    path('', include(router.urls)),
]
