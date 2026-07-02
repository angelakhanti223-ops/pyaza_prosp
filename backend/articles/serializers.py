from rest_framework import serializers

from .models import Article, ArticleGalleryImage, Category, Tag


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
