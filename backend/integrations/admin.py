from django.contrib import admin

from .models import UonClient, UonDeal, UonRequest, UonSyncLog


class UonMirrorAdmin(admin.ModelAdmin):
    """Общие настройки для read-only админок зеркал U-ON — данные приходят только
    синхронизацией, редактирование/добавление/удаление вручную не имеет смысла."""

    search_fields = ('uon_id', 'name', 'phone', 'email')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(UonRequest)
class UonRequestAdmin(UonMirrorAdmin):
    list_display = ('name', 'phone', 'status_name', 'manager_name', 'uon_created_at')
    list_filter = ('status_name',)


@admin.register(UonDeal)
class UonDealAdmin(UonMirrorAdmin):
    list_display = ('name', 'status_name', 'manager_name', 'amount', 'uon_created_at')
    list_filter = ('status_name',)


@admin.register(UonClient)
class UonClientAdmin(UonMirrorAdmin):
    list_display = ('name', 'phone', 'email', 'uon_created_at')


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
