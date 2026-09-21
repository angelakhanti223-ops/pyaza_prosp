from django.contrib import admin
from django.utils.html import format_html

from .models import Certificate, SiteImages, TeamMember


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ('name', 'role', 'is_active', 'order')
    list_filter = ('is_active',)
    search_fields = ('name', 'role')


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ('title', 'is_active', 'order')
    list_filter = ('is_active',)
    search_fields = ('title',)


MAIN_IMAGE_FIELDS = (
    'hero_background', 'why_us_solo', 'why_us_family', 'why_us_cruise',
    'why_us_excursion', 'why_us_support', 'office_photo',
)

PAGE_HERO_FIELDS = (
    'tours_hero', 'directions_hero', 'cruises_hero', 'promotions_hero',
    'certificates_hero', 'contacts_hero', 'team_hero', 'about_hero',
)

PREVIEW_FIELDS = [
    ('hero_background', 'Главная'),
    ('why_us_solo', 'Индивидуальный подбор'),
    ('why_us_family', 'Семейный отдых'),
    ('why_us_cruise', 'Круизы'),
    ('why_us_excursion', 'Экскурсионные туры'),
    ('why_us_support', 'Поддержка'),
    ('office_photo', 'Офис'),
    ('tours_hero', 'Туры'),
    ('directions_hero', 'Направления'),
    ('cruises_hero', 'Круизы'),
    ('promotions_hero', 'Акции'),
    ('certificates_hero', 'Сертификаты'),
    ('contacts_hero', 'Контакты'),
    ('team_hero', 'Команда'),
    ('about_hero', 'О компании'),
]


@admin.register(SiteImages)
class SiteImagesAdmin(admin.ModelAdmin):
    readonly_fields = ('updated_at', 'preview')
    fieldsets = (
        ('Главная страница', {'fields': MAIN_IMAGE_FIELDS}),
        ('Обложки внутренних страниц', {'fields': PAGE_HERO_FIELDS}),
        ('Предпросмотр', {'fields': ('preview', 'updated_at')}),
    )

    def has_add_permission(self, request):
        # Singleton — ровно одна запись, всегда доступная для редактирования.
        return not SiteImages.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description='Текущие изображения')
    def preview(self, obj):
        parts = []
        for field_name, label in PREVIEW_FIELDS:
            file = getattr(obj, field_name)
            if file:
                parts.append(
                    f'<div style="display:inline-block;text-align:center;margin:0 8px 8px 0;">'
                    f'<img src="{file.url}" style="height:70px;width:105px;object-fit:cover;border-radius:8px;display:block;">'
                    f'<span style="font-size:11px;color:#666;">{label}</span></div>'
                )
        return format_html(''.join(parts)) if parts else 'Пока ничего не загружено'
