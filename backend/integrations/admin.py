from django.contrib import admin

from .models import UonSyncLog


@admin.register(UonSyncLog)
class UonSyncLogAdmin(admin.ModelAdmin):
    list_display = ('lead', 'status', 'attempt_number', 'created_at')
    list_filter = ('status',)
    search_fields = ('lead__name', 'lead__phone', 'error_message')
    readonly_fields = (
        'lead', 'status', 'attempt_number', 'request_payload',
        'response_payload', 'error_message', 'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
