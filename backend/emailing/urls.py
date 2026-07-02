from django.urls import path

from . import views

urlpatterns = [
    path('subscribe/', views.SubscribeView.as_view(), name='subscribe'),
    path('email/track/open/<uuid:token>/', views.track_open, name='email-track-open'),
    path('email/track/click/<uuid:token>/', views.track_click, name='email-track-click'),
    path('email/unsubscribe/<uuid:token>/', views.unsubscribe, name='email-unsubscribe'),
]
