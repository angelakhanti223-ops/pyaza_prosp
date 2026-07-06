from django.contrib import admin

from .models import TelegramAccount, TelegramNotificationLog, generate_link_code


@admin.register(TelegramAccount)
class TelegramAccountAdmin(admin.ModelAdmin):
    list_display = ('user', 'link_code', 'chat_id', 'telegram_username', 'is_active', 'linked_at')
    list_filter = ('is_active',)
    readonly_fields = ('link_code', 'chat_id', 'telegram_username', 'linked_at', 'created_at')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'telegram_username')
    actions = ['regenerate_link_code']

    @admin.action(description='Сгенерировать новый код привязки (сбрасывает текущую привязку)')
    def regenerate_link_code(self, request, queryset):
        for account in queryset:
            account.link_code = generate_link_code()
            account.chat_id = None
            account.telegram_username = ''
            account.linked_at = None
            account.save(update_fields=['link_code', 'chat_id', 'telegram_username', 'linked_at'])


@admin.register(TelegramNotificationLog)
class TelegramNotificationLogAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'chat_id', 'status', 'created_at')
    list_filter = ('event_type', 'status')
    readonly_fields = [f.name for f in TelegramNotificationLog._meta.fields]

    def has_add_permission(self, request):
        return False
