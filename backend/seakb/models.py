from django.db import models


class SeaRegion(models.Model):
    """Общие данные базы знаний ЮВА (meta + region из knowledge_base.json:
    обзор региона, акценты продаж, готовые туры, легенда сезонности) —
    синглтон, заполняется командой import_sea_kb."""

    meta = models.JSONField('meta', default=dict, blank=True)
    region = models.JSONField('region', default=dict, blank=True)

    class Meta:
        verbose_name = 'регион ЮВА (общие данные)'
        verbose_name_plural = 'регион ЮВА (общие данные)'

    def __str__(self):
        return 'База знаний ЮВА — общие данные'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Contact(models.Model):
    """Контакт представителя сети/отеля. slug = id из JSON."""

    slug = models.SlugField('id', max_length=100, unique=True)
    name = models.CharField('Имя', max_length=255)
    company = models.CharField('Компания', max_length=255, blank=True)
    data = models.JSONField('Данные', default=dict, blank=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'контакт (ЮВА)'
        verbose_name_plural = 'контакты (ЮВА)'

    def __str__(self):
        return self.name


class AgentPerkGroup(models.Model):
    """Плюшки для агентов от сети/туроператора. slug = id из JSON."""

    slug = models.SlugField('id', max_length=100, unique=True)
    network = models.CharField('Сеть / ТО', max_length=255)
    kind = models.CharField('Тип', max_length=50, blank=True)
    order = models.PositiveIntegerField('Порядок', default=0)
    data = models.JSONField('Данные', default=dict, blank=True)

    class Meta:
        ordering = ['order', 'network']
        verbose_name = 'плюшки для агентов (ЮВА)'
        verbose_name_plural = 'плюшки для агентов (ЮВА)'

    def __str__(self):
        return self.network


class Country(models.Model):
    slug = models.SlugField('id', max_length=100, unique=True)
    name = models.CharField('Название', max_length=255)
    order = models.PositiveIntegerField('Порядок', default=0)
    data = models.JSONField('Данные (без направлений)', default=dict, blank=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'страна (ЮВА)'
        verbose_name_plural = 'страны (ЮВА)'

    def __str__(self):
        return self.name


class Destination(models.Model):
    slug = models.SlugField('id', max_length=100, unique=True)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='destinations')
    name = models.CharField('Название', max_length=255)
    type = models.CharField('Тип', max_length=100, blank=True)
    order = models.PositiveIntegerField('Порядок', default=0)
    data = models.JSONField('Данные', default=dict, blank=True)

    class Meta:
        ordering = ['country__order', 'order', 'name']
        verbose_name = 'направление (ЮВА)'
        verbose_name_plural = 'направления (ЮВА)'

    def __str__(self):
        return self.name


class Hotel(models.Model):
    slug = models.SlugField('id', max_length=100, unique=True)
    name = models.CharField('Название', max_length=255)
    brand = models.CharField('Бренд', max_length=255, blank=True)
    stars = models.FloatField('Звёзды', null=True, blank=True)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='hotels')
    destination = models.ForeignKey(Destination, on_delete=models.CASCADE, related_name='hotels')
    status = models.CharField('Статус', max_length=50, blank=True)
    detail_level = models.CharField('Детализация', max_length=20, blank=True)
    agent_perks_id = models.CharField('Группа плюшек (id)', max_length=100, blank=True)
    for_whom = models.JSONField('Для кого', default=list, blank=True)
    contacts = models.ManyToManyField(Contact, blank=True, related_name='hotels')
    data = models.JSONField('Данные', default=dict, blank=True)

    class Meta:
        ordering = ['country__order', 'destination__order', 'name']
        verbose_name = 'отель (ЮВА)'
        verbose_name_plural = 'отели (ЮВА)'

    def __str__(self):
        return self.name
