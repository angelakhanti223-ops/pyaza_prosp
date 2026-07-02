import logging

from celery import shared_task

from .adapters import UonAdapterError, build_ticket_payload, get_uon_adapter
from .models import UonSyncLog

logger = logging.getLogger('integrations.uon')

MAX_RETRIES = 5


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
