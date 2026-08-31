from rest_framework.routers import SimpleRouter

from .views import KnowledgeArticleViewSet

# SimpleRouter, не DefaultRouter — второй DefaultRouter() в процессе (первый уже
# в leads/urls.py) падает на register_converter с "Converter 'drf_format_suffix'
# is already registered" (see DRF's format_suffix_patterns).
router = SimpleRouter()
router.register('crm/knowledge-base', KnowledgeArticleViewSet, basename='crm-knowledge-article')

urlpatterns = router.urls
