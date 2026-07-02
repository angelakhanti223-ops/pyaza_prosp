from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Article, Category
from .serializers import ArticleDetailSerializer, ArticleListSerializer, CategorySerializer


def published_articles():
    return Article.objects.filter(
        status=Article.Status.PUBLISHED, published_at__lte=timezone.now(),
    ).select_related('category').prefetch_related('tags', 'gallery_images')


class CategoryListView(generics.ListAPIView):
    """Категории для фильтра в блоге (ТЗ 4.2)."""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None


class ArticleListView(generics.ListAPIView):
    """Страница списка статей с пагинацией и фильтром по категории (ТЗ 4.2)."""

    serializer_class = ArticleListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = published_articles()
        category_slug = self.request.query_params.get('category')
        if category_slug:
            qs = qs.filter(category__slug=category_slug)
        return qs


class ArticleDetailView(generics.RetrieveAPIView):
    """Страница отдельной статьи с блоком «похожие статьи» (ТЗ 4.2)."""

    serializer_class = ArticleDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        return published_articles()

    def retrieve(self, request, *args, **kwargs):
        article = self.get_object()
        data = self.get_serializer(article).data

        related = published_articles().exclude(pk=article.pk)
        if article.category_id:
            related = related.filter(category_id=article.category_id)
        data['related_articles'] = ArticleListSerializer(related[:3], many=True).data

        return Response(data)
