from django.urls import include, path
from rest_framework.routers import SimpleRouter

from . import views

# SimpleRouter, не DefaultRouter — второй DefaultRouter() в процессе падает на
# register_converter (см. тот же приём в integrations/urls.py, articles/urls.py).
router = SimpleRouter()
router.register('crm/team', views.TeamMemberCrmViewSet, basename='crm-team-member')
router.register('crm/certificates', views.CertificateCrmViewSet, basename='crm-certificate')

urlpatterns = [
    path('site-images/', views.SiteImagesView.as_view(), name='site-images'),
    path('team/', views.TeamMemberListView.as_view(), name='team-list'),
    path('certificates/', views.CertificateListView.as_view(), name='certificate-list'),
    path('', include(router.urls)),
]
