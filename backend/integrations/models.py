from django.db import models


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
