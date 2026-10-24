from django.urls import include, path
from rest_framework.routers import SimpleRouter

from . import views
from .analytics import ArticleAnalyticsView, ArticleReadEventView
from .page_analytics import PageAnalyticsView, PageReadEventView

# SimpleRouter, не DefaultRouter — второй DefaultRouter() в процессе падает на
# register_converter с "Converter 'drf_format_suffix' is already registered"
# (leads/urls.py уже регистрирует DefaultRouter; см. тот же приём в integrations/urls.py).
router = SimpleRouter()
router.register('crm/articles', views.ArticleCrmViewSet, basename='crm-article')

urlpatterns = [
    path('pages/read-event/', PageReadEventView.as_view(), name='page-read-event'),
    path('crm/pages/analytics/', PageAnalyticsView.as_view(), name='crm-page-analytics'),
    path('articles/', views.ArticleListView.as_view(), name='article-list'),
    path('articles/categories/', views.CategoryListView.as_view(), name='article-category-list'),
    path('crm/articles/categories/', views.CategoryCrmCreateView.as_view(), name='crm-article-category-create'),
    path('crm/articles/analytics/', ArticleAnalyticsView.as_view(), name='crm-article-analytics'),
    path('articles/<slug:slug>/read-event/', ArticleReadEventView.as_view(), name='article-read-event'),
    path('articles/<slug:slug>/', views.ArticleDetailView.as_view(), name='article-detail'),
    path('', include(router.urls)),
]
