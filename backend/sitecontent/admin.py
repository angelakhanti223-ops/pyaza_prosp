from django.contrib import admin
from django.utils.html import format_html

from .models import SiteImages


@admin.register(SiteImages)
class SiteImagesAdmin(admin.ModelAdmin):
    readonly_fields = ('updated_at', 'preview')
    fields = (
        'hero_background', 'why_us_solo', 'why_us_family', 'why_us_cruise',
        'why_us_excursion', 'why_us_support', 'office_photo', 'preview', 'updated_at',
    )

    def has_add_permission(self, request):
        # Singleton — ровно одна запись, всегда доступная для редактирования.
        return not SiteImages.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description='Текущие изображения')
    def preview(self, obj):
        fields = [
            ('hero_background', 'Hero'), ('why_us_solo', 'Индивидуальный подбор'),
            ('why_us_family', 'Семейный отдых'), ('why_us_cruise', 'Круизы'),
            ('why_us_excursion', 'Экскурсионные туры'), ('why_us_support', 'Поддержка'),
            ('office_photo', 'Офис'),
        ]
        parts = []
        for field_name, label in fields:
            file = getattr(obj, field_name)
            if file:
                parts.append(
                    f'<div style="display:inline-block;text-align:center;margin:0 8px 8px 0;">'
                    f'<img src="{file.url}" style="height:70px;border-radius:8px;display:block;">'
                    f'<span style="font-size:11px;color:#666;">{label}</span></div>'
                )
        return format_html(''.join(parts)) if parts else 'Пока ничего не загружено'
