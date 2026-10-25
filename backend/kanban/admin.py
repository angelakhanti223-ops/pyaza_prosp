from django.contrib import admin
from django.utils import timezone

from .models import KanbanColumn, Task, TaskAttachment
from .services import next_order_in_column


@admin.register(KanbanColumn)
class KanbanColumnAdmin(admin.ModelAdmin):
    list_display = ('name', 'status', 'is_active', 'order')
    readonly_fields = ('status', 'name', 'is_active')
    ordering = ('order',)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class TaskAttachmentInline(admin.TabularInline):
    model = TaskAttachment
    extra = 0


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        'title', 'column', 'assignee', 'lead', 'origin', 'archived_at', 'deadline', 'order',
    )
    list_filter = ('origin', 'purpose', 'closure_reason', 'archived_at', 'column', 'assignee', 'is_recurring', 'preferred_contact_channel')
    search_fields = ('title', 'description')
    inlines = [TaskAttachmentInline]
    actions = ['archive_tasks', 'restore_tasks']
    readonly_fields = ['automation_key', 'origin', 'recurrence_parent', 'column', 'closed_at', 'closure_reason']

    def get_queryset(self, request):
        return Task.all_objects.all()

    @admin.action(description='Убрать выбранные задачи в архив')
    def archive_tasks(self, request, queryset):
        for task in queryset:
            task.archived_at = timezone.now()
            task.save(update_fields=['archived_at'])

    @admin.action(description='Восстановить выбранные задачи из архива')
    def restore_tasks(self, request, queryset):
        for task in queryset:
            task.archived_at = None
            task.order = next_order_in_column(task.column)
            task.save(update_fields=['archived_at', 'order'])
