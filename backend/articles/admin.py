from django.contrib import admin
from django.utils.html import format_html

from .models import Article, ArticleGalleryImage, Category, Tag


class ArticleGalleryImageInline(admin.TabularInline):
    model = ArticleGalleryImage
    extra = 1
    fields = ('preview', 'image', 'caption', 'order')
    readonly_fields = ('preview',)

    @admin.display(description='Превью')
    def preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="height:60px;border-radius:8px;">', obj.image.url)
        return '—'


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'category', 'author', 'published_at')
    list_filter = ('status', 'category', 'tags')
    search_fields = ('title', 'seo_title', 'content')
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ('created_at', 'updated_at')
    filter_horizontal = ('tags',)
    inlines = [ArticleGalleryImageInline]

    def save_model(self, request, obj, form, change):
        if not obj.author_id:
            obj.author = request.user
        super().save_model(request, obj, form, change)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
