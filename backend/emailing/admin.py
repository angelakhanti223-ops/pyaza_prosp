from django.contrib import admin
from django.db.models import Count, Q

from .models import EmailCampaign, EmailSend, EmailSubscriber


@admin.register(EmailSubscriber)
class EmailSubscriberAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'is_active', 'consented_at', 'created_at')
    list_filter = ('is_active', 'interests')
    search_fields = ('email', 'name')


class EmailSendInline(admin.TabularInline):
    model = EmailSend
    extra = 0
    readonly_fields = ('subscriber', 'sent_at', 'opened_at', 'clicked_at')
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(EmailCampaign)
class EmailCampaignAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'subject', 'status', 'recipient_count', 'open_rate', 'click_rate', 'sent_at',
    )
    list_filter = ('status',)
    search_fields = ('name', 'subject')
    filter_horizontal = ('target_interests',)
    readonly_fields = ('status', 'created_by', 'created_at', 'sent_at')
    inlines = [EmailSendInline]
    actions = ['send_campaign']

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            sends_count=Count('sends', distinct=True),
            opens_count=Count('sends', filter=Q(sends__opened_at__isnull=False), distinct=True),
            clicks_count=Count('sends', filter=Q(sends__clicked_at__isnull=False), distinct=True),
        )

    def save_model(self, request, obj, form, change):
        if not obj.created_by_id:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    @admin.display(description='Получателей')
    def recipient_count(self, obj):
        return obj.sends_count if obj.status != EmailCampaign.Status.DRAFT else obj.recipients().count()

    @admin.display(description='Открытий')
    def open_rate(self, obj):
        if not obj.sends_count:
            return '—'
        return f'{obj.opens_count} ({obj.opens_count / obj.sends_count * 100:.0f}%)'

    @admin.display(description='Переходов')
    def click_rate(self, obj):
        if not obj.sends_count:
            return '—'
        return f'{obj.clicks_count} ({obj.clicks_count / obj.sends_count * 100:.0f}%)'

    @admin.action(description='Отправить выбранные рассылки')
    def send_campaign(self, request, queryset):
        from .tasks import send_campaign_task

        sent = 0
        for campaign in queryset.filter(status=EmailCampaign.Status.DRAFT):
            send_campaign_task.delay(campaign.id)
            sent += 1
        if sent:
            self.message_user(request, f'Запущена отправка {sent} рассылок(-и).')
        else:
            self.message_user(request, 'Нет черновиков для отправки (уже отправленные рассылки повторно не отправляются).')
