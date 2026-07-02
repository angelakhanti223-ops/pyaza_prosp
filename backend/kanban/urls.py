from django.urls import include, path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register('crm/kanban/tasks', views.TaskViewSet, basename='crm-kanban-task')

urlpatterns = [
    path('crm/kanban/columns/', views.KanbanColumnListView.as_view(), name='kanban-column-list'),
    path('', include(router.urls)),
]
