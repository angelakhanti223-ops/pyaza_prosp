from django.contrib import admin
from django.utils import timezone

from .models import KanbanColumn, Task, TaskAttachment


@admin.register(KanbanColumn)
class KanbanColumnAdmin(admin.ModelAdmin):
    list_display = ('name', 'order')
    ordering = ('order',)


class TaskAttachmentInline(admin.TabularInline):
    model = TaskAttachment
    extra = 0


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        'title', 'column', 'assignee', 'lead', 'origin', 'archived_at', 'deadline', 'order',
    )
    list_filter = ('origin', 'archived_at', 'column', 'assignee', 'is_recurring', 'preferred_contact_channel')
    search_fields = ('title', 'description')
    inlines = [TaskAttachmentInline]
    actions = ['archive_tasks', 'restore_tasks']
    readonly_fields = ['automation_key', 'origin']

    def get_queryset(self, request):
        return Task.all_objects.all()

    @admin.action(description='Убрать выбранные задачи в архив')
    def archive_tasks(self, request, queryset):
        queryset.update(archived_at=timezone.now())

    @admin.action(description='Восстановить выбранные задачи из архива')
    def restore_tasks(self, request, queryset):
        queryset.update(archived_at=None)
