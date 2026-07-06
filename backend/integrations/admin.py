from django.contrib import admin

from .models import UonClient, UonRequestRecord, UonSyncLog, UonWebhookLog


class UonMirrorAdmin(admin.ModelAdmin):
    """Общие настройки для read-only админок зеркал U-ON — данные приходят только
    синхронизацией, редактирование/добавление/удаление вручную не имеет смысла."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(UonRequestRecord)
class UonRequestRecordAdmin(UonMirrorAdmin):
    list_display = ('client_name', 'client_phone', 'status_name', 'manager_name', 'is_archive', 'uon_created_at')
    list_filter = ('status_name', 'is_archive')
    search_fields = ('uon_id', 'client_name', 'client_phone', 'client_email', 'reservation_number')


@admin.register(UonClient)
class UonClientAdmin(UonMirrorAdmin):
    list_display = ('name', 'phone', 'email', 'synced_at')
    search_fields = ('uon_id', 'name', 'phone', 'email')


@admin.register(UonWebhookLog)
class UonWebhookLogAdmin(admin.ModelAdmin):
    list_display = ('type_id', 'request_id', 'received_at')
    list_filter = ('type_id',)
    search_fields = ('request_id',)
    readonly_fields = ('payload', 'type_id', 'request_id', 'received_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


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
