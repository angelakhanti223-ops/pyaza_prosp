from django.urls import path

from . import views

urlpatterns = [
    path('sea-kb/overview/', views.SeaOverviewView.as_view(), name='seakb-overview'),
    path('sea-kb/countries/<slug:slug>/', views.CountryDetailView.as_view(), name='seakb-country'),
    path('sea-kb/destinations/<slug:slug>/', views.DestinationDetailView.as_view(), name='seakb-destination'),
    path('sea-kb/hotels/', views.HotelListView.as_view(), name='seakb-hotels'),
    path('sea-kb/hotels/<slug:slug>/', views.HotelDetailView.as_view(), name='seakb-hotel'),
    path('sea-kb/contacts/', views.ContactListView.as_view(), name='seakb-contacts'),
    path('sea-kb/agent-perks/', views.AgentPerksView.as_view(), name='seakb-agent-perks'),
]
