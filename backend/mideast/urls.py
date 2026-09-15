from django.urls import path

from . import views

urlpatterns = [
    path('mideast/hotels/', views.HotelListView.as_view(), name='mideast-hotels'),
    path('mideast/countries/', views.CountryListView.as_view(), name='mideast-countries'),
    path('mideast/airlines/', views.AirlineListView.as_view(), name='mideast-airlines'),
    path('mideast/webinars/', views.WebinarListView.as_view(), name='mideast-webinars'),
    path('mideast/meta/', views.MideastMetaView.as_view(), name='mideast-meta'),
]
