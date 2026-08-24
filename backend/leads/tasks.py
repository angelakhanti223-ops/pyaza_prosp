import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger('leads')

# «Свежий» лид должен получить задачу на первый контакт в тот же день; лид,
# который открыт, но не обновлялся дольше этого срока — задачу «без движения».
# Оба порога — решение заказчика, 19.08.2026: не по статусу воронки, а по
# реальной активности (Lead.updated_at обновляется при любом сохранении заявки).
STALE_LEAD_THRESHOLD_DAYS = 2

_NEW_LEAD_TITLE_PREFIX = '🆕 Связаться с новым лидом'
_STALE_LEAD_TITLE_PREFIX = '⏰ Лид без движения 2 дня'


@shared_task
def create_new_lead_task(lead_id: int):
    """Задача на первый контакт сразу при создании лида — без назначенного
    менеджера (на этом этапе его ещё нет), значит уведомление в Telegram уйдёт
    веерно всем активным аккаунтам (см. notify_task_created)."""
    from kanban.models import Task
    from kanban.services import next_order_in_column
    from telegrambot.services import get_first_column
    from telegrambot.tasks import notify_task_created

    from .models import Lead

    try:
        lead = Lead.objects.get(pk=lead_id)
    except Lead.DoesNotExist:
        logger.warning('Лид #%s не найден, задачу на контакт не создаём', lead_id)
        return

    column = get_first_column()
    if column is None:
        logger.warning('На доске не настроено ни одной колонки, задача на контакт не создана')
        return

    # Заголовок задачи используется как стабильный ключ для идемпотентности
    # (title__startswith в check_stale_leads/повторных запусках), поэтому в нём
    # только номер — ФИО format_task_line подтягивает отдельно через task.lead
    # при отправке в Telegram, см. telegrambot.services.resolve_task_client_name.
    task = Task.objects.create(
        title=f'{_NEW_LEAD_TITLE_PREFIX} №{lead.id}',
        description=f'Новый лид №{lead.id}\nТелефон: {lead.phone or "—"}',
        column=column, lead=lead, order=next_order_in_column(column),
    )
    notify_task_created.delay(task.id)


@shared_task
def check_stale_leads():
    """Раз в день (см. CELERY_BEAT_SCHEDULE) — открытые лиды, не обновлявшиеся
    STALE_LEAD_THRESHOLD_DAYS дней, получают задачу-напоминание «тронуть» лид.
    Идемпотентно: если такая задача уже стоит и ещё не закрыта, повторно не
    создаём (проверка по фиксированному префиксу заголовка — тот же приём, что
    уже используется для меток U-ON, см. integrations.tasks._titled)."""
    from kanban.models import Task
    from kanban.services import next_order_in_column
    from telegrambot.services import get_first_column, get_last_column
    from telegrambot.tasks import notify_task_created

    from .models import Lead

    cutoff = timezone.now() - timedelta(days=STALE_LEAD_THRESHOLD_DAYS)
    stale_leads = Lead.objects.exclude(
        status__in=[Lead.Status.CLOSED_WON, Lead.Status.CLOSED_LOST],
    ).filter(updated_at__lte=cutoff)

    column = get_first_column()
    last_column = get_last_column()
    if column is None:
        logger.warning('На доске не настроено ни одной колонки, проверка застрявших лидов пропущена')
        return

    created = 0
    for lead in stale_leads:
        existing = Task.objects.filter(lead=lead, title__startswith=_STALE_LEAD_TITLE_PREFIX)
        if last_column is not None:
            existing = existing.exclude(column=last_column)
        if existing.exists():
            continue

        task = Task.objects.create(
            title=f'{_STALE_LEAD_TITLE_PREFIX} №{lead.id}',
            description=f'Лид №{lead.id} без движения {STALE_LEAD_THRESHOLD_DAYS}+ дня\nТелефон: {lead.phone or "—"}',
            column=column, lead=lead, assignee=lead.assigned_manager,
            order=next_order_in_column(column),
        )
        notify_task_created.delay(task.id)
        created += 1

    logger.info('Проверка застрявших лидов: создано задач — %s', created)
