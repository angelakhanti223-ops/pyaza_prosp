from django.contrib import admin

from .models import (
    CommissionTier,
    Contact,
    Direction,
    Lead,
    LeadAttachment,
    LeadComment,
    LeadStatusHistory,
    LeadTag,
    MonthlyPlan,
    TourOperator,
    TourOperatorExchangeRate,
    WorkShift,
)


class LeadCommentInline(admin.TabularInline):
    model = LeadComment
    extra = 0
    readonly_fields = ('created_at',)


class LeadStatusHistoryInline(admin.TabularInline):
    model = LeadStatusHistory
    extra = 0
    readonly_fields = ('old_status', 'new_status', 'changed_by', 'changed_at')
    can_delete = False


class LeadAttachmentInline(admin.TabularInline):
    model = LeadAttachment
    extra = 0
    readonly_fields = ('uploaded_at',)


class TourOperatorExchangeRateInline(admin.TabularInline):
    model = TourOperatorExchangeRate
    extra = 1
    fields = ('currency', 'rate', 'rate_date', 'source_note', 'source_url', 'is_active')


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = (
        'full_name', 'phone_primary', 'phone_secondary', 'email_primary',
        'email_secondary', 'preferred_contact_method', 'allow_email_marketing', 'updated_at',
    )
    list_filter = ('preferred_contact_method', 'allow_email_marketing', 'allow_messenger_marketing')
    search_fields = (
        'last_name', 'first_name', 'middle_name', 'phone_primary', 'phone_secondary',
        'email_primary', 'email_secondary',
    )
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('ФИО и данные клиента', {'fields': ('last_name', 'first_name', 'middle_name', 'birth_date')}),
        ('Контакты', {'fields': ('phone_primary', 'phone_secondary', 'email_primary', 'email_secondary', 'preferred_contact_method')}),
        ('Рассылки', {'fields': ('allow_email_marketing', 'allow_messenger_marketing')}),
        ('Примечание', {'fields': ('note',)}),
        ('Служебное', {'fields': ('created_at', 'updated_at')}),
    )


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'phone', 'status', 'source', 'assigned_manager', 'contact',
        'tour_operator_ref', 'tour_currency', 'payment_exchange_rate', 'created_at',
    )
    list_filter = ('status', 'source', 'direction', 'assigned_manager', 'tour_operator_ref', 'tour_currency', 'preferred_messenger', 'tags')
    search_fields = (
        'name', 'phone', 'email', 'uon_ticket_id', 'booking_number', 'tour_operator',
        'contact__last_name', 'contact__first_name', 'contact__middle_name',
        'contact__phone_primary', 'contact__phone_secondary', 'contact__email_primary', 'contact__email_secondary',
    )
    readonly_fields = ('created_at', 'updated_at')
    filter_horizontal = ('tags',)
    inlines = [LeadCommentInline, LeadStatusHistoryInline, LeadAttachmentInline]


@admin.register(LeadTag)
class LeadTagAdmin(admin.ModelAdmin):
    list_display = ('name', 'color', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)


@admin.register(Direction)
class DirectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)


@admin.register(TourOperator)
class TourOperatorAdmin(admin.ModelAdmin):
    list_display = ('brand_name', 'legal_name', 'inn', 'registry_number', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('brand_name', 'legal_name', 'inn', 'ogrn', 'registry_number')
    inlines = [TourOperatorExchangeRateInline]
    fieldsets = (
        ('Основное', {'fields': ('brand_name', 'legal_name', 'is_active')}),
        ('Реестр и реквизиты', {'fields': ('inn', 'ogrn', 'registry_number', 'activity_scope', 'payment_details')}),
        ('Контакты', {'fields': ('website', 'phone', 'email', 'address')}),
        ('Примечание', {'fields': ('note',)}),
    )


@admin.register(TourOperatorExchangeRate)
class TourOperatorExchangeRateAdmin(admin.ModelAdmin):
    list_display = ('operator', 'currency', 'rate', 'rate_date', 'source_note', 'is_active', 'updated_at')
    list_filter = ('operator', 'currency', 'rate_date', 'is_active')
    search_fields = ('operator__brand_name', 'operator__legal_name', 'source_note')
    date_hierarchy = 'rate_date'
    ordering = ('operator__brand_name', 'currency', '-rate_date')


@admin.register(CommissionTier)
class CommissionTierAdmin(admin.ModelAdmin):
    list_display = ('name', 'threshold', 'commission_percent')
    list_editable = ('threshold', 'commission_percent')
    ordering = ('threshold',)


@admin.register(MonthlyPlan)
class MonthlyPlanAdmin(admin.ModelAdmin):
    list_display = ('manager', 'year', 'month', 'base_salary', 'bonus_percent')
    list_editable = ('bonus_percent',)
    list_filter = ('year', 'month', 'manager')


@admin.register(WorkShift)
class WorkShiftAdmin(admin.ModelAdmin):
    list_display = ('date', 'manager')
    list_editable = ('manager',)
    list_filter = ('manager',)
    date_hierarchy = 'date'
    ordering = ('date',)
