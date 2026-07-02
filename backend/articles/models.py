from django.conf import settings
from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)

    class Meta:
        verbose_name_plural = 'categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Article(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Черновик'
        PUBLISHED = 'published', 'Опубликовано'
        ARCHIVED = 'archived', 'Архив'

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='articles',
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name='articles')
    excerpt = models.TextField(blank=True)
    content = models.TextField()
    featured_image = models.ImageField(upload_to='articles/%Y/%m/', blank=True, null=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='articles',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)

    # SEO (ТЗ 4.1)
    seo_title = models.CharField(max_length=255, blank=True)
    seo_description = models.CharField(max_length=500, blank=True)
    og_image = models.ImageField(upload_to='articles/og/%Y/%m/', blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-published_at', '-created_at']

    def __str__(self):
        return self.title
