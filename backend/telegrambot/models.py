import secrets

from django.conf import settings
from django.db import models


def generate_link_code() -> str:
    return secrets.token_hex(6)


class TelegramAccount(models.Model):
    """Привязка Telegram-чата менеджера к его аккаунту в системе.

    Руководитель создаёт запись в Django admin (без chat_id) — система
    генерирует `link_code`, который менеджер отправляет боту через
    `/start <code>`; бот проставляет `chat_id` и `linked_at`.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='telegram_account',
    )
    link_code = models.CharField(max_length=32, unique=True, default=generate_link_code, editable=False)
    chat_id = models.BigIntegerField('ID чата в Telegram', unique=True, null=True, blank=True)
    telegram_username = models.CharField('Username в Telegram', max_length=255, blank=True)
    is_active = models.BooleanField('Уведомления включены', default=True)
    linked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user} — {"привязан" if self.chat_id else "код не использован"}'


class TelegramNotificationLog(models.Model):
    """Журнал попыток отправки уведомлений в Telegram — по одной записи на попытку,
    по образцу integrations.models.UonSyncLog (используется для диагностики сбоев)."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Ожидает отправки'
        SUCCESS = 'success', 'Успешно'
        FAILED = 'failed', 'Ошибка'

    class EventType(models.TextChoices):
        TASK_ASSIGNED = 'task_assigned', 'Назначена задача'
        LEAD_ASSIGNED = 'lead_assigned', 'Назначена заявка'

    chat_id = models.BigIntegerField()
    event_type = models.CharField(max_length=30, choices=EventType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_event_type_display()} → {self.chat_id}: {self.get_status_display()}'
