import logging

import requests
from celery import shared_task
from django.conf import settings

from .models import TelegramAccount, TelegramNotificationLog
from .services import (
    build_board_url,
    build_lead_url,
    build_uon_record_url,
    format_lead_summary,
    format_task_line,
    is_local_url,
)

logger = logging.getLogger('telegrambot')

MAX_RETRIES = 5


class TelegramSendError(Exception):
    """Raised on any failure calling the Telegram Bot API — triggers Celery retry."""


def _link_button(text: str, url: str) -> dict | None:
    # Telegram отклоняет кнопки со ссылкой на localhost (см. services.is_local_url) —
    # обычная ситуация, пока сайт не задеплоен на реальный домен.
    if is_local_url(url):
        return None
    return {'inline_keyboard': [[{'text': text, 'url': url}]]}


def _send_telegram_message(chat_id: int, text: str, event_type: str, reply_markup: dict | None = None) -> None:
    log = TelegramNotificationLog.objects.create(
        chat_id=chat_id, event_type=event_type, status=TelegramNotificationLog.Status.PENDING,
    )
    payload = {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'}
    if reply_markup is not None:
        payload['reply_markup'] = reply_markup

    try:
        response = requests.post(
            f'{settings.TELEGRAM_API_BASE_URL}/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage',
            json=payload,
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        log.status = TelegramNotificationLog.Status.FAILED
        log.error_message = str(exc)
        log.save(update_fields=['status', 'error_message'])
        raise TelegramSendError(str(exc)) from exc

    log.status = TelegramNotificationLog.Status.SUCCESS
    log.save(update_fields=['status'])


@shared_task(
    bind=True,
    autoretry_for=(TelegramSendError,),
    retry_backoff=60,
    retry_backoff_max=3600,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
)
def notify_task_assignment(self, task_id: int):
    """Уведомляет исполнителя задачи в Telegram, если у него привязан аккаунт."""
    from kanban.models import Task

    if not settings.TELEGRAM_BOT_ENABLED:
        logger.debug('Telegram отключён (TELEGRAM_BOT_ENABLED=False) — уведомление о задаче #%s пропущено', task_id)
        return

    try:
        task = Task.objects.select_related('assignee', 'column', 'lead').get(pk=task_id)
    except Task.DoesNotExist:
        logger.warning('Telegram: задача #%s не найдена, пропускаем', task_id)
        return

    if not task.assignee_id:
        return

    account = TelegramAccount.objects.filter(
        user_id=task.assignee_id, is_active=True, chat_id__isnull=False,
    ).first()
    if account is None:
        logger.info('Telegram: у пользователя #%s нет привязанного аккаунта, пропускаем', task.assignee_id)
        return

    text = f'🆕 Вам назначена задача:\n{format_task_line(task)}'
    if task.uon_record_kind and task.uon_record_id:
        url = build_uon_record_url(task.uon_record_kind, task.uon_record_id)
    elif task.lead_id:
        url = build_lead_url(task.lead_id)
    else:
        url = build_board_url()
    _send_telegram_message(
        account.chat_id, text, TelegramNotificationLog.EventType.TASK_ASSIGNED,
        reply_markup=_link_button('🔗 Открыть в CRM', url),
    )


@shared_task(
    bind=True,
    autoretry_for=(TelegramSendError,),
    retry_backoff=60,
    retry_backoff_max=3600,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
)
def notify_lead_assignment(self, lead_id: int):
    """Уведомляет ответственного менеджера в Telegram о назначении заявки."""
    from leads.models import Lead

    if not settings.TELEGRAM_BOT_ENABLED:
        logger.debug('Telegram отключён (TELEGRAM_BOT_ENABLED=False) — уведомление о заявке #%s пропущено', lead_id)
        return

    try:
        lead = Lead.objects.select_related('assigned_manager', 'direction').get(pk=lead_id)
    except Lead.DoesNotExist:
        logger.warning('Telegram: заявка #%s не найдена, пропускаем', lead_id)
        return

    if not lead.assigned_manager_id:
        return

    account = TelegramAccount.objects.filter(
        user_id=lead.assigned_manager_id, is_active=True, chat_id__isnull=False,
    ).first()
    if account is None:
        logger.info('Telegram: у пользователя #%s нет привязанного аккаунта, пропускаем', lead.assigned_manager_id)
        return

    text = f'🆕 Вам назначена заявка:\n{format_lead_summary(lead)}'
    _send_telegram_message(
        account.chat_id, text, TelegramNotificationLog.EventType.LEAD_ASSIGNED,
        reply_markup=_link_button('🔗 Открыть в CRM', build_lead_url(lead.id)),
    )
