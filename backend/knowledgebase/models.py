from django.conf import settings
from django.db import models
from django_ckeditor_5.fields import CKEditor5Field


class KnowledgeArticle(models.Model):
    """Внутренняя база знаний CRM (по направлениям/отелям/перевозчикам) — для
    справки менеджеров при подборе тура, не публикуется на сайте. Импортируется
    из готовых HTML-документов через `manage.py import_knowledge_html`, либо
    правится прямо в CRM/админке."""

    title = models.CharField('Заголовок', max_length=255)
    direction = models.ForeignKey(
        'leads.Direction', on_delete=models.SET_NULL, null=True, blank=True, related_name='knowledge_articles',
    )
    content = CKEditor5Field('Содержание', config_name='default')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='knowledge_articles',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title
