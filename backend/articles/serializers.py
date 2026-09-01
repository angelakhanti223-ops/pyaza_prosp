from rest_framework import serializers

from accounts.serializers import UserSerializer

from .models import Article, ArticleGalleryImage, Category, Tag
from .utils import unique_slug


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug']


class ArticleGalleryImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleGalleryImage
        fields = ['id', 'image', 'caption', 'order']


class ArticleListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)

    class Meta:
        model = Article
        fields = ['id', 'title', 'slug', 'excerpt', 'featured_image', 'category', 'tags', 'published_at']


class ArticleDetailSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    gallery_images = ArticleGalleryImageSerializer(many=True, read_only=True)

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'slug', 'excerpt', 'content', 'featured_image', 'category', 'tags',
            'seo_title', 'seo_description', 'og_image', 'published_at', 'gallery_images',
        ]


# --- CRM (авторинг статей сотрудниками, ТЗ по требованию клиента, 01.09.2026 —
# раньше единственным способом создать/поправить статью была /admin/, отдельно от CRM) ---


class ArticleCrmListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    author = UserSerializer(read_only=True)

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'slug', 'status', 'status_display', 'category', 'category_name',
            'author', 'published_at', 'updated_at',
        ]


class ArticleCrmDetailSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    author = UserSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    # Пишем теги свободным текстом (через запятую на форме), а не по id — get_or_create
    # в _set_tags ниже, чтобы автору статьи не приходилось заранее заводить тег отдельно.
    tag_names = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'slug', 'category', 'category_name', 'tags', 'tag_names', 'excerpt', 'content',
            'featured_image', 'author', 'status', 'status_display', 'published_at',
            'seo_title', 'seo_description', 'og_image', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']
        extra_kwargs = {'slug': {'required': False}}

    def validate_slug(self, value):
        value = value.strip()
        if not value:
            return value
        qs = Article.objects.filter(slug=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Такой адрес (slug) уже занят другой статьёй.')
        return value

    def create(self, validated_data):
        tag_names = validated_data.pop('tag_names', None)
        validated_data['author'] = self.context['request'].user
        if not validated_data.get('slug'):
            validated_data['slug'] = unique_slug(Article, validated_data['title'])
        article = super().create(validated_data)
        if tag_names is not None:
            self._set_tags(article, tag_names)
        return article

    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tag_names', None)
        # Заголовок можно поменять и не потерять уже опубликованный URL — slug
        # регенерируется автоматически только при создании, не здесь.
        if 'slug' in validated_data and not validated_data['slug']:
            validated_data.pop('slug')
        article = super().update(instance, validated_data)
        if tag_names is not None:
            self._set_tags(article, tag_names)
        return article

    def _set_tags(self, article, tag_names):
        tags = []
        for raw in tag_names:
            name = raw.strip()
            if not name:
                continue
            tag, _ = Tag.objects.get_or_create(name=name, defaults={'slug': unique_slug(Tag, name)})
            tags.append(tag)
        article.tags.set(tags)


class CategoryCrmCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']
        read_only_fields = ['id', 'slug']

    def create(self, validated_data):
        validated_data['slug'] = unique_slug(Category, validated_data['name'])
        return super().create(validated_data)
