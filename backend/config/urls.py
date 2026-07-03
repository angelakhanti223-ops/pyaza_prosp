from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('ckeditor5/', include('django_ckeditor_5.urls')),
    path('api/health/', health, name='health'),
    path('api/', include('leads.urls')),
    path('api/', include('emailing.urls')),
    path('api/', include('accounts.urls')),
    path('api/', include('articles.urls')),
    path('api/', include('kanban.urls')),
    path('api/', include('sitecontent.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
