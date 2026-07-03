from django.urls import path

from . import views

urlpatterns = [
    path('site-images/', views.SiteImagesView.as_view(), name='site-images'),
]
