from django.contrib import admin

from .models import AgentPerkGroup, Contact, Country, Destination, Hotel, SeaRegion


@admin.register(SeaRegion)
class SeaRegionAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not SeaRegion.objects.exists()


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'order')
    search_fields = ('name', 'slug')


@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'country', 'type')
    list_filter = ('country',)
    search_fields = ('name', 'slug')


@admin.register(Hotel)
class HotelAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'country', 'destination', 'stars', 'status', 'detail_level')
    list_filter = ('country', 'destination', 'stars', 'status', 'detail_level')
    search_fields = ('name', 'slug', 'brand')
    filter_horizontal = ('contacts',)


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ('name', 'company', 'slug')
    search_fields = ('name', 'company', 'slug')


@admin.register(AgentPerkGroup)
class AgentPerkGroupAdmin(admin.ModelAdmin):
    list_display = ('network', 'slug', 'kind', 'order')
    search_fields = ('network', 'slug')
