import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django_ckeditor_5.fields import CKEditor5Field


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
    content = CKEditor5Field(config_name='default')
    featured_image = models.ImageField(upload_to='articles/%Y/%m/', blank=True, null=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='articles',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    views = models.PositiveIntegerField(
        'Просмотров', default=0,
        help_text='Исторический итог и новые открытия статьи в браузере. '
                   'Повторная отправка одного события не увеличивает счётчик.',
    )

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

    def save(self, *args, **kwargs):
        # First time an article is published without an explicit date, publish now.
        # If an editor sets a future published_at before switching to "published",
        # that value is kept as-is — the public API hides it until that time (ТЗ 4.1
        # "Планирование публикации").
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)


class ArticleGalleryImage(models.Model):
    """Карусель изображений статьи — отдельный блок, отображается после текста статьи."""

    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='gallery_images')
    image = models.ImageField(upload_to='articles/gallery/%Y/%m/')
    caption = models.CharField(max_length=255, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.caption or f'Изображение #{self.pk} — {self.article.title}'


class ArticleReadSession(models.Model):
    """One page opening, with cumulative visible/focused time. No visitor identity."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='read_sessions')
    started_at = models.DateTimeField(default=timezone.now, editable=False)
    last_seen_at = models.DateTimeField(default=timezone.now)
    active_ms = models.PositiveIntegerField(default=0)
    duration_reported = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=['started_at'], name='article_read_started_idx'),
            models.Index(fields=['article', 'started_at'], name='article_read_article_idx'),
        ]


class PageReadSession(models.Model):
    """Anonymous opening of an allowed public page; no query string or visitor identity."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    path = models.CharField(max_length=512)
    title = models.CharField(max_length=255)
    started_at = models.DateTimeField(default=timezone.now, editable=False)
    last_seen_at = models.DateTimeField(default=timezone.now)
    active_ms = models.PositiveIntegerField(default=0)
    duration_reported = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=['started_at'], name='page_read_started_idx'),
            models.Index(fields=['path', 'started_at'], name='page_read_path_idx'),
        ]
