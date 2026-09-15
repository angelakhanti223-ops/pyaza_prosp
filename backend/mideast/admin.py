from django.contrib import admin

from .models import Airline, Country, DatasetMeta, Hotel, RixosDossier, Webinar


@admin.register(Webinar)
class WebinarAdmin(admin.ModelAdmin):
    list_display = ('number', 'title', 'src')
    ordering = ('number',)
    search_fields = ('title',)


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('name', 'capital', 'order')
    list_editable = ('order',)
    search_fields = ('name',)


@admin.register(Airline)
class AirlineAdmin(admin.ModelAdmin):
    list_display = ('name', 'country', 'order')
    list_editable = ('order',)
    search_fields = ('name',)


@admin.register(Hotel)
class HotelAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'country', 'region', 'brand', 'category',
        'f_all_inclusive', 'f_beach', 'f_kids_friendly', 'f_spa', 'f_russian_staff',
    )
    list_filter = ('country', 'brand_group', 'f_all_inclusive', 'f_beach', 'f_kids_friendly', 'f_spa', 'f_russian_staff')
    search_fields = ('name', 'brand', 'region', 'location')


@admin.register(RixosDossier)
class RixosDossierAdmin(admin.ModelAdmin):
    list_display = ('title',)

    def has_add_permission(self, request):
        return not RixosDossier.objects.exists()


@admin.register(DatasetMeta)
class DatasetMetaAdmin(admin.ModelAdmin):
    list_display = ('source', 'built', 'presentations_count')

    def has_add_permission(self, request):
        return not DatasetMeta.objects.exists()
