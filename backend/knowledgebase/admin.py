from django.contrib import admin

from .models import KnowledgeArticle


@admin.register(KnowledgeArticle)
class KnowledgeArticleAdmin(admin.ModelAdmin):
    list_display = ('title', 'direction', 'author', 'updated_at')
    list_filter = ('direction',)
    search_fields = ('title',)
    readonly_fields = ('created_at', 'updated_at')
