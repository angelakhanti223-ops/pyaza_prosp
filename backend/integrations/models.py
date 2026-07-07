from django.db import models


class UonMirrorRecord(models.Model):
    """Общие поля для read-only зеркал сущностей U-ON (Обращения/Заявки/Клиенты) —
    редактирование этих данных ведётся в самом U-ON, здесь только просмотр в CRM.
    `raw_data` хранит весь исходный ответ API — поле-страховка на случай, если
    точная структура ответа U-ON окажется шире тех полей, что вынесены отдельно."""

    uon_id = models.CharField('ID в U-ON', max_length=64, unique=True)
    raw_data = models.JSONField('Сырые данные из U-ON', default=dict, blank=True)
    synced_at = models.DateTimeField('Последняя синхронизация', auto_now=True)

    class Meta:
        abstract = True


class UonRequestRecord(UonMirrorRecord):
    """Заявка, как она реально хранится в U-ON (подтверждено на живом API:
    GET /{key}/request/{id}.json — возвращает {"request": [{...}]}). В этом API
    нет отдельного ресурса «сделка»: вся воронка (status_id/status) и данные
    клиента уже находятся прямо в объекте заявки. Обновляется либо вебхуком
    (UonWebhookView), либо вручную по уже известным нам ID (sync_all_uon_requests
    проходит по Lead.uon_ticket_id — списочного эндпоинта в API попросту нет)."""

    reservation_number = models.CharField('Номер брони', max_length=64, blank=True)
    client_id = models.CharField('ID клиента в U-ON', max_length=64, blank=True)
    client_name = models.CharField('Имя клиента', max_length=255, blank=True)
    client_phone = models.CharField('Телефон', max_length=32, blank=True)
    client_email = models.EmailField('Email', blank=True)
    status_id = models.CharField('ID статуса в U-ON', max_length=20, blank=True)
    status_name = models.CharField('Статус в U-ON', max_length=100, blank=True)
    manager_name = models.CharField('Менеджер в U-ON', max_length=255, blank=True)
    source_name = models.CharField('Источник', max_length=100, blank=True)
    notes = models.TextField('Заметки', blank=True)
    is_archive = models.BooleanField('В архиве', default=False)
    uon_created_at = models.DateTimeField('Создана в U-ON', null=True, blank=True)

    class Meta:
        verbose_name = 'заявка U-ON'
        verbose_name_plural = 'заявки U-ON'
        ordering = ['-uon_created_at', '-synced_at']

    def __str__(self):
        return f'{self.client_name} ({self.client_phone})' if self.client_name else f'Заявка U-ON #{self.uon_id}'


class UonLeadRecord(UonMirrorRecord):
    """Обращение — в терминах U-ON это «лид» (/lead), самая ранняя стадия контакта
    (подтверждено на живом API: GET /{key}/lead/{id}.json). Отдельная сущность от
    «заявки» (/request) со своей последовательностью ID — не путать: id и id_system
    у лида расходятся (смещение не постоянное), у заявки обычно совпадают.
    Один лид может позже превратиться в заявку (когда менеджер начинает её вести
    в U-ON) — это уже другой ID в /request, однозначной связи между ними в API нет."""

    client_id = models.CharField('ID клиента в U-ON', max_length=64, blank=True)
    client_name = models.CharField('Имя клиента', max_length=255, blank=True)
    client_phone = models.CharField('Телефон', max_length=32, blank=True)
    client_email = models.EmailField('Email', blank=True)
    status_id = models.CharField('ID статуса в U-ON', max_length=20, blank=True)
    status_name = models.CharField('Статус в U-ON', max_length=100, blank=True)
    manager_name = models.CharField('Менеджер в U-ON', max_length=255, blank=True)
    source_name = models.CharField('Источник', max_length=100, blank=True)
    notes = models.TextField('Заметки', blank=True)
    is_archive = models.BooleanField('В архиве', default=False)
    uon_created_at = models.DateTimeField('Создано в U-ON', null=True, blank=True)

    class Meta:
        verbose_name = 'обращение U-ON'
        verbose_name_plural = 'обращения U-ON'
        ordering = ['-uon_created_at', '-synced_at']

    def __str__(self):
        return f'{self.client_name} ({self.client_phone})' if self.client_name else f'Обращение U-ON #{self.uon_id}'


class UonClient(UonMirrorRecord):
    """Карточка клиента — в этом API нет отдельного /client-эндпоинта, поэтому
    запись собирается из client_*-полей, уже вложенных в объект заявки/обращения,
    при каждой синхронизации UonRequestRecord/UonLeadRecord. `uon_id` здесь —
    это client_id из U-ON, а не id заявки/обращения."""

    name = models.CharField('Имя', max_length=255, blank=True)
    phone = models.CharField('Телефон', max_length=32, blank=True)
    email = models.EmailField('Email', blank=True)

    class Meta:
        verbose_name = 'клиент U-ON'
        verbose_name_plural = 'клиенты U-ON'
        ordering = ['-synced_at']

    def __str__(self):
        return f'{self.name} ({self.phone})' if self.name else f'Клиент U-ON #{self.uon_id}'


class UonWebhookLog(models.Model):
    """Сырые payload'ы вебхуков U-ON — журнал для диагностики, т.к. полная таблица
    type_id (74+ событий) нам недоступна: мы реагируем на любое событие с request_id,
    не разбирая точный тип, и здесь можно посмотреть, что реально приходит."""

    payload = models.JSONField('Payload')
    type_id = models.CharField('type_id из payload', max_length=20, blank=True)
    request_id = models.CharField('request_id из payload', max_length=64, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-received_at']
        verbose_name = 'вебхук U-ON'
        verbose_name_plural = 'вебхуки U-ON'

    def __str__(self):
        return f'type_id={self.type_id} request_id={self.request_id} ({self.received_at:%Y-%m-%d %H:%M})'


class UonSyncLog(models.Model):
    """Журнал попыток отправки заявки в U-ON (ТЗ 8.2) — по одной записи на каждую попытку,
    используется адаптером интеграции (см. модуль integrations) для очереди повторов через Celery
    и для диагностики сбоев."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Ожидает отправки'
        SUCCESS = 'success', 'Успешно'
        FAILED = 'failed', 'Ошибка'

    lead = models.ForeignKey('leads.Lead', on_delete=models.CASCADE, related_name='uon_sync_logs')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    attempt_number = models.PositiveIntegerField(default=1)
    request_payload = models.JSONField(blank=True, null=True)
    response_payload = models.JSONField(blank=True, null=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Заявка #{self.lead_id}, попытка {self.attempt_number}: {self.get_status_display()}'
