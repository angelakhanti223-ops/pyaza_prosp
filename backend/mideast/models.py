from django.db import models


class Webinar(models.Model):
    """Источник — вебинар курса ПАК Универ «Ближний Восток» (PAC Experts, август–
    сентябрь 2026), на который ссылаются записи Country/Airline/Hotel через
    webinar_numbers (решение заказчика, 15.09.2026 — публичная база отелей
    Ближнего Востока вместо самодостаточного HTML-файла)."""

    number = models.PositiveSmallIntegerField('№ вебинара', unique=True)
    title = models.CharField('Название', max_length=255)
    url = models.URLField('Ссылка', max_length=500, blank=True)
    src = models.CharField('Источник субтитров/записи', max_length=50, blank=True)
    presentation = models.CharField('Презентация', max_length=255, blank=True)

    class Meta:
        ordering = ['number']
        verbose_name = 'вебинар-источник'
        verbose_name_plural = 'вебинары-источники'

    def __str__(self):
        return f'№{self.number}: {self.title}'


class Country(models.Model):
    """Страноведческое досье направления (виза, валюта, сезонность и т.д.) —
    вкладка «Страны» базы отелей Ближнего Востока."""

    name = models.CharField('Страна', max_length=100, unique=True)
    capital = models.TextField('Столица', blank=True)
    visa = models.TextField('Виза', blank=True)
    currency = models.TextField('Валюта', blank=True)
    language = models.TextField('Язык', blank=True)
    flight = models.TextField('Перелёт', blank=True)
    season = models.TextField('Сезонность', blank=True)
    alcohol = models.TextField('Алкоголь', blank=True)
    dress_code = models.TextField('Дресс-код', blank=True)
    transport = models.TextField('Транспорт', blank=True)
    safety = models.TextField('Безопасность', blank=True)
    geography = models.TextField('География', blank=True)

    # Списки/структуры — вложенные объекты одного типа, отображаются целиком,
    # по отдельности не фильтруются и не ищутся, поэтому не отдельные модели.
    emirates = models.JSONField('Эмираты/регионы', default=list, blank=True)
    highlights = models.JSONField('Достопримечательности', default=list, blank=True)
    events = models.JSONField('События', default=list, blank=True)
    activities = models.JSONField('Активности', default=list, blank=True)
    selling_points = models.JSONField('Акценты продаж', default=list, blank=True)
    news = models.JSONField('Новости', default=list, blank=True)
    practical = models.JSONField('Практическая информация', default=list, blank=True)
    webinar_numbers = models.JSONField('№ вебинаров-источников', default=list, blank=True)
    presentations = models.JSONField('Презентации-источники', default=list, blank=True)

    order = models.PositiveIntegerField('Порядок отображения', default=0)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'страна'
        verbose_name_plural = 'страны'

    def __str__(self):
        return self.name


class Airline(models.Model):
    """Досье авиакомпании — вкладка «Авиакомпании»."""

    name = models.CharField('Авиакомпания', max_length=100)
    country = models.CharField('Страна', max_length=100, blank=True)
    hub = models.TextField('Хаб', blank=True)
    routes_from_russia = models.TextField('Маршруты из России', blank=True)
    network = models.TextField('Сеть направлений', blank=True)
    fleet = models.TextField('Флот', blank=True)
    classes = models.TextField('Классы обслуживания', blank=True)
    baggage = models.TextField('Багаж', blank=True)
    loyalty = models.TextField('Программа лояльности', blank=True)
    stopover = models.TextField('Стоповер', blank=True)
    lounges = models.TextField('Бизнес-залы', blank=True)
    onboard = models.TextField('На борту', blank=True)
    notes = models.JSONField('Заметки', default=list, blank=True)
    webinar_numbers = models.JSONField('№ вебинаров-источников', default=list, blank=True)
    presentations = models.JSONField('Презентации-источники', default=list, blank=True)

    order = models.PositiveIntegerField('Порядок отображения', default=0)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'авиакомпания'
        verbose_name_plural = 'авиакомпании'

    def __str__(self):
        return self.name


class Hotel(models.Model):
    """Карточка отеля — основное содержимое базы (вкладка «Отели»)."""

    name = models.CharField('Название', max_length=255)
    brand = models.CharField('Бренд/сеть', max_length=255, blank=True)
    brand_group = models.CharField('Группа бренда', max_length=100, blank=True)
    country = models.CharField('Страна', max_length=100)
    region = models.CharField('Регион/эмират', max_length=100, blank=True)
    location = models.TextField('Локация', blank=True)
    category = models.CharField('Категория', max_length=150, blank=True)
    status = models.TextField('Статус', blank=True)
    rooms = models.TextField('Номерной фонд', blank=True)
    room_min = models.CharField('Мин. площадь номера', max_length=255, blank=True)
    room_types = models.TextField('Типы номеров', blank=True)
    meals = models.TextField('Питание', blank=True)
    beach = models.TextField('Пляж', blank=True)
    pools = models.TextField('Бассейны', blank=True)
    kids = models.TextField('Дети', blank=True)
    spa = models.TextField('Спа', blank=True)
    restaurants = models.TextField('Рестораны', blank=True)
    deposit = models.TextField('Депозит', blank=True)
    transfer = models.TextField('Трансфер', blank=True)
    russian_staff = models.TextField('Русскоговорящий персонал', blank=True)
    news = models.TextField('Новости/реновации', blank=True)
    best_for = models.TextField('Кому подойдёт', blank=True)
    not_for = models.TextField('Кому не подойдёт', blank=True)

    usp = models.JSONField('Фишки', default=list, blank=True)
    details = models.JSONField('Доп. детали (label/value)', default=list, blank=True)
    webinar_numbers = models.JSONField('№ вебинаров-источников', default=list, blank=True)
    presentations = models.JSONField('Презентации-источники', default=list, blank=True)

    # Плоские поля-флаги — специально не в JSON, чтобы фильтровать по ним в БД.
    f_all_inclusive = models.BooleanField('Всё включено', default=False)
    f_kids_friendly = models.BooleanField('Подходит детям', default=False)
    f_beach = models.BooleanField('Есть пляж', default=False)
    f_spa = models.BooleanField('Есть спа', default=False)
    f_russian_staff = models.BooleanField('Русскоговорящий персонал', default=False)
    f_has_presentation = models.BooleanField('Есть презентация-источник', default=False)
    status_flag = models.CharField('Статус (для фильтра)', max_length=100, blank=True)

    photo = models.ImageField('Фото', upload_to='mideast/hotels/', blank=True, null=True)

    class Meta:
        ordering = ['country', 'name']
        verbose_name = 'отель'
        verbose_name_plural = 'отели'

    def __str__(self):
        return self.name


class RixosDossier(models.Model):
    """Отдельное досье по бренду Rixos (обзор сети целиком, не привязан к одной
    стране и не отдельный отель) — синглтон, редактируется в Django admin."""

    title = models.CharField('Заголовок', max_length=255, default='Rixos')
    brand_overview = models.TextField('Обзор бренда', blank=True)
    concepts = models.JSONField('Концепции', default=list, blank=True)
    kids_programs = models.JSONField('Детские программы', default=list, blank=True)
    entertainment = models.JSONField('Развлечения', default=list, blank=True)
    hotels_list = models.JSONField('Список отелей', default=list, blank=True)
    selling_points = models.JSONField('Акценты продаж', default=list, blank=True)
    news = models.JSONField('Новости', default=list, blank=True)

    class Meta:
        verbose_name = 'досье Rixos'
        verbose_name_plural = 'досье Rixos'

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1, defaults={'title': 'Rixos'})
        return obj


class DatasetMeta(models.Model):
    """Информация об источнике всей базы, для подвала страницы — синглтон."""

    built = models.CharField('Собрано', max_length=100, blank=True)
    source = models.CharField('Источник', max_length=255, blank=True)
    presentations_count = models.PositiveIntegerField('Кол-во презентаций', default=0)
    note = models.TextField('Примечание', blank=True)

    class Meta:
        verbose_name = 'информация об источнике базы'
        verbose_name_plural = 'информация об источнике базы'

    def __str__(self):
        return 'База «Ближний Восток» — источник'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
