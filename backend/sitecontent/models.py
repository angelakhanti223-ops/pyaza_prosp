from django.db import models


class SiteImages(models.Model):
    """Управляемые изображения публичного сайта — единственная запись (синглтон).

    Пока картинка не загружена, фронтенд показывает временную заглушку — так что
    можно спокойно оставлять поля пустыми, ничего не сломается.
    """

    hero_background = models.ImageField(
        'Главный экран (hero)', upload_to='site/', blank=True, null=True,
    )
    why_us_solo = models.ImageField(
        '«Индивидуальный подбор»', upload_to='site/', blank=True, null=True,
    )
    why_us_family = models.ImageField(
        '«Семейный отдых»', upload_to='site/', blank=True, null=True,
    )
    why_us_cruise = models.ImageField(
        '«Круизы»', upload_to='site/', blank=True, null=True,
    )
    why_us_excursion = models.ImageField(
        '«Экскурсионные туры»', upload_to='site/', blank=True, null=True,
    )
    why_us_support = models.ImageField(
        '«Поддержка без стресса»', upload_to='site/', blank=True, null=True,
    )
    office_photo = models.ImageField(
        'Фото офиса', upload_to='site/', blank=True, null=True,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'изображения сайта'
        verbose_name_plural = 'изображения сайта'

    def __str__(self):
        return 'Изображения сайта'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
