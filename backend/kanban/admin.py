from django.contrib import admin

from .models import KanbanColumn, Task


@admin.register(KanbanColumn)
class KanbanColumnAdmin(admin.ModelAdmin):
    list_display = ('name', 'order')
    ordering = ('order',)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'column', 'assignee', 'lead', 'deadline', 'order')
    list_filter = ('column', 'assignee')
    search_fields = ('title', 'description')
