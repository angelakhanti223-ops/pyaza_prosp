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
    format_plan_summary,
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


TELEGRAM_MESSAGE_LIMIT = 4096


def _split_message(text: str, limit: int = TELEGRAM_MESSAGE_LIMIT) -> list[str]:
    """Режет текст на части не длиннее лимита sendMessage — по границам строк,
    чтобы не разорвать HTML-тег (у нас все теги открываются и закрываются в
    пределах одной строки, см. telegrambot.services). Длинные дайджесты
    (утренняя сводка, /tasks на полсотни задач) иначе Telegram отвергает
    целиком с 400 Bad Request — как и произошло 25.08.2026."""
    if len(text) <= limit:
        return [text]
    chunks = []
    current = ''
    for line in text.split('\n'):
        candidate = f'{current}\n{line}' if current else line
        if len(candidate) > limit:
            if current:
                chunks.append(current)
            current = line
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def _send_telegram_message(chat_id: int, text: str, event_type: str, reply_markup: dict | None = None) -> None:
    chunks = _split_message(text)
    for i, chunk in enumerate(chunks):
        log = TelegramNotificationLog.objects.create(
            chat_id=chat_id, event_type=event_type, status=TelegramNotificationLog.Status.PENDING,
        )
        payload = {'chat_id': chat_id, 'text': chunk, 'parse_mode': 'HTML'}
        if reply_markup is not None and i == len(chunks) - 1:
            payload['reply_markup'] = reply_markup

        try:
            response = requests.post(
                f'{settings.TELEGRAM_API_BASE_URL}/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage',
                json=payload,
                timeout=10,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            # Тело ответа Telegram (поле description) обычно куда информативнее
            # str(exc) — например, прямо называет причину вроде "message is too
            # long", а не просто "400 Client Error".
            detail = getattr(exc.response, 'text', '') if exc.response is not None else ''
            log.status = TelegramNotificationLog.Status.FAILED
            log.error_message = f'{exc}\n{detail}'.strip()
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


@shared_task(
    bind=True,
    autoretry_for=(TelegramSendError,),
    retry_backoff=60,
    retry_backoff_max=3600,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
)
def notify_lead_status_change(self, lead_id: int, new_status: str):
    """Уведомляет ответственного менеджера о переходе заявки в ключевой статус
    (бронь/оплата/отказ) — не на каждую смену статуса, только эти три, чтобы
    не превращать уведомления в шум (решение заказчика, 19.08.2026)."""
    from leads.models import Lead

    if not settings.TELEGRAM_BOT_ENABLED:
        return

    try:
        lead = Lead.objects.select_related('assigned_manager', 'direction').get(pk=lead_id)
    except Lead.DoesNotExist:
        logger.warning('Telegram: заявка #%s не найдена, пропускаем уведомление о статусе', lead_id)
        return

    if not lead.assigned_manager_id:
        return

    account = TelegramAccount.objects.filter(
        user_id=lead.assigned_manager_id, is_active=True, chat_id__isnull=False,
    ).first()
    if account is None:
        return

    icons = {
        Lead.Status.BOOKED: '🎫',
        Lead.Status.PAID: '💰',
        Lead.Status.CLOSED_LOST: '❌',
    }
    icon = icons.get(new_status, 'ℹ️')
    status_label = dict(Lead.Status.choices).get(new_status, new_status)
    text = f'{icon} Заявка перешла в статус «{status_label}»:\n{format_lead_summary(lead)}'
    _send_telegram_message(
        account.chat_id, text, TelegramNotificationLog.EventType.LEAD_ASSIGNED,
        reply_markup=_link_button('🔗 Открыть в CRM', build_lead_url(lead.id)),
    )


@shared_task(
    bind=True,
    autoretry_for=(TelegramSendError,),
    retry_backoff=60,
    retry_backoff_max=3600,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
)
def notify_lead_client_replied(self, lead_id: int):
    """Уведомляет ответственного менеджера, что клиент ответил по обращению —
    вызывается из integrations.tasks._close_active_chains при гашении цепочки
    автозадач по причине closed_client_replied (см. uonfollowupspec.md)."""
    from leads.models import Lead

    if not settings.TELEGRAM_BOT_ENABLED:
        return

    try:
        lead = Lead.objects.select_related('assigned_manager', 'direction').get(pk=lead_id)
    except Lead.DoesNotExist:
        logger.warning('Telegram: заявка #%s не найдена, пропускаем уведомление об ответе клиента', lead_id)
        return

    if not lead.assigned_manager_id:
        return

    account = TelegramAccount.objects.filter(
        user_id=lead.assigned_manager_id, is_active=True, chat_id__isnull=False,
    ).first()
    if account is None:
        return

    text = f'💬 Клиент ответил по заявке:\n{format_lead_summary(lead)}'
    _send_telegram_message(
        account.chat_id, text, TelegramNotificationLog.EventType.LEAD_ASSIGNED,
        reply_markup=_link_button('🔗 Открыть в CRM', build_lead_url(lead.id)),
    )


@shared_task
def notify_task_created(task_id: int):
    """Уведомление о новой задаче: исполнителю, а если его нет — всем сотрудникам."""
    from kanban.models import Task

    if not settings.TELEGRAM_BOT_ENABLED:
        logger.debug('Telegram отключён — уведомление о задаче #%s пропущено', task_id)
        return

    try:
        task = Task.objects.select_related('assignee', 'column', 'lead').get(pk=task_id)
    except Task.DoesNotExist:
        logger.warning('Telegram: задача #%s не найдена, пропускаем', task_id)
        return

    accounts = TelegramAccount.objects.filter(is_active=True, chat_id__isnull=False)
    if task.assignee_id:
        accounts = accounts.filter(user_id=task.assignee_id)
        text = f'\U0001f195 Вам назначена задача:\n{format_task_line(task)}'
    else:
        text = f'\U0001f195 Новая задача, исполнитель не назначен:\n{format_task_line(task)}'

    if task.uon_record_kind and task.uon_record_id:
        url = build_uon_record_url(task.uon_record_kind, task.uon_record_id)
    elif task.lead_id:
        url = build_lead_url(task.lead_id)
    else:
        url = build_board_url()
    markup = _link_button('\U0001f517 Открыть в CRM', url)

    sent = 0
    for account in accounts:
        try:
            _send_telegram_message(
                account.chat_id, text,
                TelegramNotificationLog.EventType.TASK_ASSIGNED,
                reply_markup=markup,
            )
            sent += 1
        except TelegramSendError as exc:
            logger.warning('Telegram: не отправлено в чат %s: %s', account.chat_id, exc)
    logger.info('Telegram: задача #%s — уведомлений отправлено: %s', task_id, sent)


@shared_task
def notify_daily_deadlines():
    """Утренняя сводка: задачи с дедлайном сегодня плюс просроченные незакрытые."""
    from django.utils import timezone as tz
    from kanban.models import Task
    from telegrambot.services import get_last_column

    if not settings.TELEGRAM_BOT_ENABLED:
        return

    today = tz.localdate()
    queryset = Task.objects.select_related('assignee', 'column', 'lead').filter(
        deadline__isnull=False, deadline__date__lte=today,
    ).order_by('deadline')
    last_column = get_last_column()
    if last_column is not None:
        queryset = queryset.exclude(column_id=last_column.pk)

    tasks = list(queryset)
    if not tasks:
        logger.info('Telegram: задач с дедлайном на сегодня нет')
        return

    accounts = TelegramAccount.objects.filter(is_active=True, chat_id__isnull=False)
    markup = _link_button('\U0001f517 Открыть доску', build_board_url())
    sent = 0
    for account in accounts:
        mine = [t for t in tasks if t.assignee_id in (account.user_id, None)]
        if not mine:
            continue
        today_tasks = [t for t in mine if tz.localtime(t.deadline).date() == today]
        overdue = [t for t in mine if tz.localtime(t.deadline).date() < today]
        lines = []
        if today_tasks:
            lines.append('\U0001f4c5 <b>Задачи на сегодня</b>')
            lines.extend(format_task_line(t) for t in today_tasks)
        if overdue:
            if lines:
                lines.append('')
            lines.append('⏰ <b>Просрочено</b>')
            lines.extend(format_task_line(t) for t in overdue)
        try:
            _send_telegram_message(
                account.chat_id, '\n'.join(lines),
                TelegramNotificationLog.EventType.TASK_ASSIGNED,
                reply_markup=markup,
            )
            sent += 1
        except TelegramSendError as exc:
            logger.warning('Telegram: сводка не отправлена в чат %s: %s', account.chat_id, exc)
    logger.info('Telegram: утренняя сводка — задач %s, получателей %s', len(tasks), sent)


@shared_task
def notify_weekly_plan_progress():
    """Еженедельная сводка план/факт по комиссии текущего месяца — руководителю
    целиком по офису, менеджеру — только его собственная строка."""
    from django.utils import timezone as tz

    from accounts.permissions import is_head
    from leads.dashboard import plan_progress_rows

    if not settings.TELEGRAM_BOT_ENABLED:
        return

    today = tz.localdate()
    year, month = today.year, today.month
    all_rows = plan_progress_rows(year, month, managers=None)
    if not all_rows:
        logger.info('Telegram: план на %s.%s не задан — рассылка пропущена', month, year)
        return

    accounts = TelegramAccount.objects.select_related('user').filter(is_active=True, chat_id__isnull=False)
    sent = 0
    for account in accounts:
        if is_head(account.user):
            rows = all_rows
        else:
            rows = [r for r in all_rows if r['manager_id'] == account.user_id]
            if not rows:
                continue
        target_total = sum((r['target'] for r in rows), 0)
        actual_total = sum((r['actual'] for r in rows), 0)
        text = format_plan_summary(year, month, rows, target_total, actual_total)
        try:
            _send_telegram_message(account.chat_id, text, TelegramNotificationLog.EventType.PLAN_DIGEST)
            sent += 1
        except TelegramSendError as exc:
            logger.warning('Telegram: план не отправлен в чат %s: %s', account.chat_id, exc)
    logger.info('Telegram: еженедельная сводка по плану — получателей %s', sent)
