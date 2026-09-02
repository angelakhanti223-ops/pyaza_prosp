from django.db import models


class TeamMember(models.Model):
    """Публичная карточка сотрудника — страница «Команда» (ТЗ по требованию клиента,
    01.09.2026). Не путать с accounts.User — это отдельная, публично видимая
    визитка (можно завести карточку человеку, у которого вообще нет логина в CRM)."""

    name = models.CharField('Имя', max_length=255)
    role = models.CharField('Должность', max_length=255)
    bio = models.TextField('О себе', blank=True)
    photo = models.ImageField('Фото', upload_to='team/', blank=True, null=True)
    phone = models.CharField('Телефон', max_length=32, blank=True)
    email = models.EmailField('Email', blank=True)
    order = models.PositiveIntegerField('Порядок отображения', default=0)
    is_active = models.BooleanField('Показывать на сайте', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'сотрудник'
        verbose_name_plural = 'команда'
        ordering = ['order', 'id']

    def __str__(self):
        return self.name


class Certificate(models.Model):
    """Сертификат/диплом — страница «Сертификаты» (подтверждение квалификации,
    например аттестация Екатерины Макеевой — ТЗ по требованию клиента, 01.09.2026)."""

    title = models.CharField('Название', max_length=255)
    image = models.ImageField('Скан/фото сертификата', upload_to='certificates/')
    description = models.TextField('Описание', blank=True)
    order = models.PositiveIntegerField('Порядок отображения', default=0)
    is_active = models.BooleanField('Показывать на сайте', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'сертификат'
        verbose_name_plural = 'сертификаты'
        ordering = ['order', 'id']

    def __str__(self):
        return self.title


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
