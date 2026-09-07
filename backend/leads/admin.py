from django.contrib import admin

from .models import CommissionTier, Direction, Lead, LeadAttachment, LeadComment, LeadStatusHistory, MonthlyPlan, WorkShift


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


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'status', 'source', 'assigned_manager', 'created_at')
    list_filter = ('status', 'source', 'direction', 'assigned_manager')
    search_fields = ('name', 'phone', 'email', 'uon_ticket_id')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [LeadCommentInline, LeadStatusHistoryInline, LeadAttachmentInline]


@admin.register(Direction)
class DirectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)


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
