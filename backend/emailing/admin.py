from django.contrib import admin

from .models import EmailSubscriber


@admin.register(EmailSubscriber)
class EmailSubscriberAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'is_active', 'consented_at', 'created_at')
    list_filter = ('is_active', 'interests')
    search_fields = ('email', 'name')
