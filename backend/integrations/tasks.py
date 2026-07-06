import logging
from datetime import datetime as dt

from celery import shared_task
from django.utils import timezone

from .adapters import UonAdapterError, build_ticket_payload, get_uon_adapter
from .models import UonSyncLog

logger = logging.getLogger('integrations.uon')

MAX_RETRIES = 5


def _parse_uon_datetime(value):
    if not value:
        return None
    naive = dt.strptime(value, '%Y-%m-%d %H:%M')
    return timezone.make_aware(naive, timezone.get_current_timezone())


@shared_task(
    bind=True,
    autoretry_for=(UonAdapterError,),
    retry_backoff=60,
    retry_backoff_max=3600,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
)
def sync_lead_to_uon(self, lead_id: int):
    """Отправляет заявку в U-ON и сохраняет ID обращения на заявке (ТЗ 8).

    Каждая попытка пишет отдельную запись в UonSyncLog. При сбое Celery
    автоматически ставит задачу в очередь повтора с экспоненциальной
    задержкой (до MAX_RETRIES раз), чтобы временная недоступность U-ON
    не приводила к потере заявки.
    """
    from leads.models import Lead

    try:
        lead = Lead.objects.select_related('direction').get(pk=lead_id)
    except Lead.DoesNotExist:
        logger.warning('U-ON sync: заявка #%s не найдена, пропускаем', lead_id)
        return

    attempt_number = self.request.retries + 1
    payload = build_ticket_payload(lead)
    log = UonSyncLog.objects.create(
        lead=lead, status=UonSyncLog.Status.PENDING, attempt_number=attempt_number, request_payload=payload,
    )

    try:
        response = get_uon_adapter().create_ticket(payload)
    except UonAdapterError as exc:
        log.status = UonSyncLog.Status.FAILED
        log.error_message = str(exc)
        log.save(update_fields=['status', 'error_message'])
        logger.warning('U-ON sync: заявка #%s, попытка %s не удалась: %s', lead_id, attempt_number, exc)
        raise

    log.status = UonSyncLog.Status.SUCCESS
    log.response_payload = response
    log.save(update_fields=['status', 'response_payload'])

    ticket_id = response.get('ticket_id', '')
    lead.uon_ticket_id = ticket_id
    lead.save(update_fields=['uon_ticket_id'])
    logger.info('U-ON sync: заявка #%s синхронизирована, ticket_id=%s', lead_id, ticket_id)


@shared_task(
    bind=True,
    autoretry_for=(UonAdapterError,),
    retry_backoff=60,
    retry_backoff_max=3600,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
)
def pull_uon_reminders_for_lead(self, lead_id: int):
    """Подтягивает напоминания/дела по заявке из U-ON в Kanban.

    Создаёт/обновляет Task по uon_reminder_id (повторный запуск безопасен —
    без дублей). Выполненные в U-ON напоминания (is_done) переносятся в
    последнюю колонку доски, невыполненные — в первую (если задача уже была
    на доске и её передвинули вручную в другую колонку, повторный вызов не
    трогает title/deadline существующей позиции, только переносит между
    первой/последней при смене статуса выполнения в U-ON).
    """
    from kanban.models import Task
    from kanban.services import next_order_in_column, reposition_task
    from leads.models import Lead
    from telegrambot.services import get_first_column, get_last_column

    try:
        lead = Lead.objects.get(pk=lead_id)
    except Lead.DoesNotExist:
        logger.warning('U-ON reminders: заявка #%s не найдена, пропускаем', lead_id)
        return

    if not lead.uon_ticket_id:
        logger.debug('U-ON reminders: у заявки #%s нет uon_ticket_id, пропускаем', lead_id)
        return

    reminders = get_uon_adapter().list_reminders(lead.uon_ticket_id)

    first_column = get_first_column()
    last_column = get_last_column()
    if first_column is None:
        logger.warning('U-ON reminders: на доске не настроено ни одной колонки, пропускаем')
        return

    for reminder in reminders:
        reminder_id = str(reminder['id'])
        title = reminder.get('text') or f'Напоминание U-ON #{reminder_id}'
        deadline = _parse_uon_datetime(reminder.get('datetime'))
        is_done = bool(reminder.get('is_done'))
        target_column = last_column if (is_done and last_column) else first_column

        task = Task.objects.filter(uon_reminder_id=reminder_id).first()
        if task is None:
            Task.objects.create(
                uon_reminder_id=reminder_id, title=title[:255], lead=lead, deadline=deadline,
                column=target_column, assignee=lead.assigned_manager,
                order=next_order_in_column(target_column),
            )
        else:
            if task.column_id != target_column.id:
                reposition_task(task, target_column, next_order_in_column(target_column))
            task.title = title[:255]
            task.deadline = deadline
            task.save(update_fields=['title', 'deadline'])

    logger.info('U-ON reminders: заявка #%s — синхронизировано %s напоминаний', lead_id, len(reminders))


@shared_task
def sync_all_uon_reminders():
    """Периодическая задача (Celery Beat) — обходит все заявки с привязкой к U-ON
    и подтягивает по каждой свежие напоминания."""
    from leads.models import Lead

    lead_ids = list(Lead.objects.exclude(uon_ticket_id='').values_list('id', flat=True))
    for lead_id in lead_ids:
        pull_uon_reminders_for_lead.delay(lead_id)
    logger.info('U-ON reminders: запущена синхронизация для %s заявок', len(lead_ids))
