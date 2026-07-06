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


class UonRequest(UonMirrorRecord):
    """Заявка, как она хранится в U-ON (эндпоинт /request). Соответствует нашему
    собственному Lead только на этапе, пока заявка ещё не стала обращением (сделкой)."""

    name = models.CharField('Имя клиента', max_length=255, blank=True)
    phone = models.CharField('Телефон', max_length=32, blank=True)
    email = models.EmailField('Email', blank=True)
    status_name = models.CharField('Статус в U-ON', max_length=100, blank=True)
    manager_name = models.CharField('Менеджер в U-ON', max_length=255, blank=True)
    source_name = models.CharField('Источник', max_length=100, blank=True)
    comment = models.TextField('Комментарий', blank=True)
    uon_created_at = models.DateTimeField('Создана в U-ON', null=True, blank=True)

    class Meta:
        verbose_name = 'заявка U-ON'
        verbose_name_plural = 'заявки U-ON'
        ordering = ['-uon_created_at', '-synced_at']

    def __str__(self):
        return f'{self.name} ({self.phone})' if self.name else f'Заявка U-ON #{self.uon_id}'


class UonDeal(UonMirrorRecord):
    """Обращение — в терминах U-ON это сделка (/deal), создаваемая из заявки после
    того, как мы отправляем Lead в U-ON (см. integrations.tasks.sync_lead_to_uon).
    Lead.uon_ticket_id указывает именно на такую запись."""

    name = models.CharField('Название', max_length=255, blank=True)
    status_name = models.CharField('Статус в U-ON', max_length=100, blank=True)
    manager_name = models.CharField('Менеджер в U-ON', max_length=255, blank=True)
    amount = models.DecimalField('Сумма', max_digits=12, decimal_places=2, null=True, blank=True)
    request_uon_id = models.CharField('ID заявки в U-ON', max_length=64, blank=True)
    uon_created_at = models.DateTimeField('Создано в U-ON', null=True, blank=True)

    class Meta:
        verbose_name = 'обращение U-ON'
        verbose_name_plural = 'обращения U-ON'
        ordering = ['-uon_created_at', '-synced_at']

    def __str__(self):
        return self.name or f'Обращение U-ON #{self.uon_id}'


class UonClient(UonMirrorRecord):
    """Карточка клиента в U-ON (/client)."""

    name = models.CharField('Имя', max_length=255, blank=True)
    phone = models.CharField('Телефон', max_length=32, blank=True)
    email = models.EmailField('Email', blank=True)
    uon_created_at = models.DateTimeField('Создан в U-ON', null=True, blank=True)

    class Meta:
        verbose_name = 'клиент U-ON'
        verbose_name_plural = 'клиенты U-ON'
        ordering = ['-uon_created_at', '-synced_at']

    def __str__(self):
        return f'{self.name} ({self.phone})' if self.name else f'Клиент U-ON #{self.uon_id}'


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
