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

    Этим же ежедневным проходом пересчитываются автоматические метки заявок:
    контроль оплаты, выдача документов, ближайший вылет и просроченные действия.
    """
    from kanban.models import Task
    from kanban.services import next_order_in_column
    from telegrambot.services import get_first_column, get_last_column
    from telegrambot.tasks import notify_task_created

    from .auto_tags import sync_automatic_tags_for_all_leads
    from .models import Lead

    auto_tags_result = sync_automatic_tags_for_all_leads()
    logger.info('Автоматические метки заявок: %s', auto_tags_result)

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


@shared_task
def sync_automatic_lead_tags():
    """Пересчитывает автоматические метки заявок по дедлайнам оплаты,
    следующему контакту и ближайшей дате вылета."""
    from .auto_tags import sync_automatic_tags_for_all_leads

    result = sync_automatic_tags_for_all_leads()
    logger.info('Автоматические метки заявок: %s', result)
    return result


@shared_task
def sync_uon_operator_exchange_rates():
    """Ежедневно забирает курсы туроператоров из U-ON и сохраняет их в CRM.

    Источник — страница кабинета U-ON "Финансы → Курсы валют → Курсы валют ТО".
    Курс хранится отдельно по каждому туроператору, валюте и дате, потому что у
    разных ТО внутренние курсы отличаются друг от друга.
    """
    from .uon_operator_rates import sync_operator_exchange_rates_from_uon

    result = sync_operator_exchange_rates_from_uon()
    logger.info('Синхронизация курсов ТО из U-ON: %s', result)
    return result
