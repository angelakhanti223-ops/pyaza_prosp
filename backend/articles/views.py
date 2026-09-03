from django.db.models import F
from django.utils import timezone
from rest_framework import generics, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Article, Category
from .serializers import (
    ArticleCrmDetailSerializer,
    ArticleCrmListSerializer,
    ArticleDetailSerializer,
    ArticleListSerializer,
    CategoryCrmCreateSerializer,
    CategorySerializer,
)


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

        # F()-инкремент (не article.save()) — атомарно на уровне БД и не задевает
        # остальные поля/save()-хук со статусом публикации. Next.js вызывает
        # fetchArticle() дважды на один реальный визит (generateMetadata + сама
        # страница), но обе идут в рамках одного request-рендера, и встроенная
        # request-мемоизация fetch() схлопывает их в один сетевой запрос — здесь
        # это не удваивает счётчик (проверено вживую при разработке).
        Article.objects.filter(pk=article.pk).update(views=F('views') + 1)

        data = self.get_serializer(article).data

        related = published_articles().exclude(pk=article.pk)
        if article.category_id:
            related = related.filter(category_id=article.category_id)
        data['related_articles'] = ArticleListSerializer(related[:3], many=True).data

        return Response(data)


# --- CRM (авторинг статей сотрудниками — раздел «Статьи» в CRM, ТЗ по требованию
# клиента, 01.09.2026, до этого правки шли только через /admin/) ---


class ArticleCrmViewSet(viewsets.ModelViewSet):
    """Полный CRUD для статей из CRM — доступен любому залогиненному сотруднику,
    без разделения по ролям (общий, коллективно поддерживаемый блог, как и knowledgebase)."""

    queryset = Article.objects.select_related('category', 'author').prefetch_related('tags')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return ArticleCrmListSerializer
        return ArticleCrmDetailSerializer


class CategoryCrmCreateView(generics.CreateAPIView):
    """Быстрое добавление новой категории прямо из формы статьи в CRM — чтобы
    завести категорию для блога не приходилось идти в /admin/."""

    queryset = Category.objects.all()
    serializer_class = CategoryCrmCreateSerializer
    permission_classes = [IsAuthenticated]
