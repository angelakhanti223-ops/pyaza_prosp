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
    try:
        naive = dt.strptime(value, '%Y-%m-%d %H:%M')
    except ValueError:
        # Формат "%Y-%m-%d %H:%M" подтверждён и для reminder.datetime, и для
        # request.dat_request на живом API — но не роняем синхронизацию, если
        # какое-то другое поле окажется в ином формате.
        logger.warning('U-ON: не удалось разобрать дату %r', value)
        return None
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
    """Отправляет заявку в U-ON и сохраняет полученный ID на заявке (ТЗ 8).

    Каждая попытка пишет отдельную запись в UonSyncLog. При сбое Celery
    автоматически ставит задачу в очередь повтора с экспоненциальной
    задержкой (до MAX_RETRIES раз), чтобы временная недоступность U-ON
    не приводила к потере заявки.

    ВАЖНОЕ ОГРАНИЧЕНИЕ (подтверждено на живом API): POST /lead/create.json
    создаёт запись именно в сущности «лид» — она ещё НЕ равна «заявке»
    (/request), к которой относятся list_reminders()/get_request(). ID,
    который здесь сохраняется в lead.uon_ticket_id, живёт в ID-пространстве
    lead, а не request — get_request(этот id) вернёт None, пока менеджер
    вручную не проработает лид в самом U-ON и тот не превратится в заявку
    (request) с отдельным ID. До этого момента синхронизация напоминаний/
    зеркала для только что созданной заявки не найдёт данных — это ожидаемо.
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

    ticket_id = str(response.get('id', ''))
    lead.uon_ticket_id = ticket_id
    lead.save(update_fields=['uon_ticket_id'])
    logger.info('U-ON sync: заявка #%s синхронизирована, lead_id в U-ON=%s', lead_id, ticket_id)


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


@shared_task(
    bind=True,
    autoretry_for=(UonAdapterError,),
    retry_backoff=60,
    retry_backoff_max=3600,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
)
def sync_uon_request(self, request_id: str):
    """Подтягивает/обновляет одну заявку из U-ON по её ID — источник и для read-only
    зеркала «Заявки» в CRM, и для карточки клиента (в этом API нет отдельного
    /client-эндпоинта, данные клиента уже вложены в объект заявки).

    Вызывается либо вебхуком U-ON (UonWebhookView — событие поступает мгновенно
    при создании/изменении заявки), либо вручную через sync_all_uon_requests."""
    from .models import UonClient, UonRequestRecord

    data = get_uon_adapter().get_request(request_id)
    if not data:
        logger.warning('U-ON: заявка %s не найдена при синхронизации', request_id)
        return False

    client_name = f"{data.get('client_surname', '')} {data.get('client_name', '')}".strip()
    client_phone = data.get('client_phone_mobile') or data.get('client_phone', '')
    client_email = data.get('client_email', '')

    UonRequestRecord.objects.update_or_create(
        uon_id=str(data['id']),
        defaults={
            'reservation_number': data.get('reservation_number') or '',
            'client_id': str(data.get('client_id') or ''),
            'client_name': client_name,
            'client_phone': client_phone,
            'client_email': client_email,
            'status_id': str(data.get('status_id') or ''),
            'status_name': data.get('status') or '',
            'manager_name': data.get('manager_name') or '',
            'source_name': data.get('source') or '',
            'notes': data.get('notes') or '',
            'is_archive': bool(data.get('is_archive')),
            'uon_created_at': _parse_uon_datetime(data.get('dat_request') or data.get('created_at')),
            'raw_data': data,
        },
    )

    client_id = data.get('client_id')
    if client_id:
        UonClient.objects.update_or_create(
            uon_id=str(client_id),
            defaults={
                'name': client_name,
                'phone': client_phone,
                'email': client_email,
                'raw_data': {k: v for k, v in data.items() if k.startswith('client_')},
            },
        )

    logger.info('U-ON: заявка %s синхронизирована', request_id)
    return True


@shared_task(
    bind=True,
    autoretry_for=(UonAdapterError,),
    retry_backoff=60,
    retry_backoff_max=3600,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
)
def sync_uon_lead(self, lead_id: str):
    """Подтягивает/обновляет одно обращение (лид) из U-ON по его ID — источник
    для read-only зеркала «Обращения» в CRM и для карточки клиента.

    Вызывается либо вебхуком U-ON, либо вручную через sync_all_uon_leads."""
    from .models import UonClient, UonLeadRecord

    data = get_uon_adapter().get_lead(lead_id)
    if not data:
        logger.warning('U-ON: обращение %s не найдено при синхронизации', lead_id)
        return False

    client_name = f"{data.get('client_surname', '')} {data.get('client_name', '')}".strip()
    client_phone = data.get('client_phone_mobile') or data.get('client_phone', '')
    client_email = data.get('client_email', '')

    UonLeadRecord.objects.update_or_create(
        uon_id=str(data['id']),
        defaults={
            'client_id': str(data.get('client_id') or ''),
            'client_name': client_name,
            'client_phone': client_phone,
            'client_email': client_email,
            'status_id': str(data.get('status_id') or ''),
            'status_name': data.get('status') or '',
            'manager_name': data.get('manager_name') or '',
            'source_name': data.get('source') or '',
            'notes': data.get('notes') or '',
            'is_archive': bool(data.get('is_archive')),
            'uon_created_at': _parse_uon_datetime(data.get('dat_lead') or data.get('created_at')),
            'raw_data': data,
        },
    )

    client_id = data.get('client_id')
    if client_id:
        UonClient.objects.update_or_create(
            uon_id=str(client_id),
            defaults={
                'name': client_name,
                'phone': client_phone,
                'email': client_email,
                'raw_data': {k: v for k, v in data.items() if k.startswith('client_')},
            },
        )

    logger.info('U-ON: обращение %s синхронизировано', lead_id)
    return True


@shared_task
def sync_all_uon_leads():
    """Ручная/периодическая синхронизация зеркала обращений — в API U-ON нет
    списочного эндпоинта, поэтому обходим уже известные нам ID (Lead.uon_ticket_id
    — это ID именно U-ON-обращения/лида, см. docstring sync_lead_to_uon). Обращения,
    заведённые вручную прямо в U-ON и никогда не привязанные к нашему Lead, этим
    способом не подтянуть — для них нужен вебхук либо разовый импорт по диапазону
    ID (management-команда backfill_uon)."""
    from leads.models import Lead

    ticket_ids = list(Lead.objects.exclude(uon_ticket_id='').values_list('uon_ticket_id', flat=True))
    for ticket_id in ticket_ids:
        sync_uon_lead.delay(ticket_id)
    logger.info('U-ON: запущена синхронизация обращений для %s ID', len(ticket_ids))
