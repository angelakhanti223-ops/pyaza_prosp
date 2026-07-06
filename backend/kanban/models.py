from django.conf import settings
from django.db import models


class KanbanColumn(models.Model):
    """Настраиваемая колонка доски (ТЗ 6): например Новая → В работе → Ждём клиента → Готово."""

    name = models.CharField(max_length=100)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name


class Task(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    column = models.ForeignKey(KanbanColumn, on_delete=models.PROTECT, related_name='tasks')
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='kanban_tasks',
    )
    lead = models.ForeignKey(
        'leads.Lead', on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks',
    )
    uon_reminder_id = models.CharField(
        'ID напоминания U-ON', max_length=64, unique=True, null=True, blank=True,
        help_text='Заполняется автоматически при синхронизации напоминаний из U-ON — не редактировать вручную.',
    )
    deadline = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['column', 'order']

    def __str__(self):
        return self.title
