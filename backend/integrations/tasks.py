import logging
from datetime import datetime as dt
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .adapters import UonAdapterError, build_ticket_payload, get_uon_adapter
from .models import UonSyncLog

logger = logging.getLogger('integrations.uon')

MAX_RETRIES = 5


def _s(data: dict, *keys: str) -> str:
    """Достаёт первое непустое строковое значение по списку ключей — важно
    использовать вместо `data.get(key, '')`, т.к. в реальном API поле может
    быть явным JSON null (не отсутствовать), а не только отсутствовать: в
    этом случае .get(key, '') всё равно вернёт None, а не '', что роняет
    сохранение в NOT NULL CharField (подтверждено на живых данных заявки #2)."""
    for key in keys:
        value = data.get(key)
        if value:
            return str(value)
    return ''


def _parse_uon_datetime(value):
    if not value:
        return None
    naive = None
    for _fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
        try:
            naive = dt.strptime(value, _fmt)
            break
        except ValueError:
            continue
    if naive is None:
        # Формат "%Y-%m-%d %H:%M" подтверждён и для reminder.datetime, и для
        # request.dat_request на живом API — но не роняем синхронизацию, если
        # какое-то другое поле окажется в ином формате.
        logger.warning('U-ON: не удалось разобрать дату %r', value)
        return None
    return timezone.make_aware(naive, timezone.get_current_timezone())


def _parse_uon_date(value):
    """Как _parse_uon_datetime, но для дат без времени (день рождения, паспорт,
    загранпаспорт) — и отбрасывает "0001-01-01 00:00", которым U-ON заполняет
    пустую дату вместо null (подтверждено на живых данных туристов)."""
    if not value or str(value).startswith('0001-01-01'):
        return None
    try:
        return dt.strptime(value, '%Y-%m-%d %H:%M').date()
    except ValueError:
        logger.warning('U-ON: не удалось разобрать дату %r', value)
        return None


def _client_defaults_from_tourist(tourist: dict, is_main: bool) -> dict:
    """Полный набор полей туриста из tourists[] заявки (подтверждено на живом
    API) — самый богатый источник данных о человеке, доступный в этом API."""
    sex_map = {1: 'муж', 2: 'жен'}
    try:
        sex = sex_map.get(int(tourist.get('u_sex') or 0), '')
    except (TypeError, ValueError):
        sex = ''
    return {
        'name': _s(tourist, 'u_name'),
        'surname': _s(tourist, 'u_surname'),
        'patronymic': _s(tourist, 'u_sname'),
        'name_en': _s(tourist, 'u_name_en'),
        'surname_en': _s(tourist, 'u_surname_en'),
        'phone': _s(tourist, 'u_phone_mobile', 'u_phone'),
        'phone_home': _s(tourist, 'u_phone_home'),
        'email': _s(tourist, 'u_email'),
        'sex': sex,
        'birthday': _parse_uon_date(tourist.get('u_birthday')),
        'passport_number': _s(tourist, 'u_passport_number'),
        'passport_issued_by': _s(tourist, 'u_passport_taken'),
        'passport_date': _parse_uon_date(tourist.get('u_passport_date')),
        'zagran_number': _s(tourist, 'u_zagran_number'),
        'zagran_expire': _parse_uon_date(tourist.get('u_zagran_expire')),
        'address': _s(tourist, 'address'),
        'company': _s(tourist, 'u_company'),
        'inn': _s(tourist, 'u_inn'),
        'telegram': _s(tourist, 'u_telegram'),
        'whatsapp': _s(tourist, 'u_whatsapp'),
        'viber': _s(tourist, 'u_viber'),
        'social_vk': _s(tourist, 'u_social_vk'),
        'instagram': _s(tourist, 'u_instagram'),
        'country': _s(tourist, 'country'),
        'city': _s(tourist, 'city'),
        'nationality': _s(tourist, 'nationality'),
        'notes': _s(tourist, 'u_note'),
        'is_main_contact': is_main,
        'raw_data': tourist,
    }


def _client_defaults_basic(data: dict, name: str, phone: str, email: str) -> dict:
    """Заявки без tourists[] (обращения/lead всегда, заявки/request изредка) —
    единственное, что есть о клиенте, это client_*-поля самого объекта."""
    return {
        'name': name,
        'phone': phone,
        'email': email,
        'is_main_contact': True,
        'raw_data': {k: v for k, v in data.items() if k.startswith('client_')},
    }


def _match_manager_user(manager_name: str):
    """Сопоставляет ответственного по имени менеджера из U-ON (например
    «Екатерина Макеева») с пользователем CRM — по первому слову ФИО, без учёта
    регистра, среди first_name. Если совпадения нет — задача остаётся без
    ответственного (назначить можно вручную)."""
    if not manager_name:
        return None
    first_token = manager_name.strip().split()[0] if manager_name.strip() else ''
    if not first_token:
        return None
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.filter(first_name__iexact=first_token).first()


_RECORD_LABELS = {'request': 'Заявка', 'lead': 'Обращение'}


def _sync_tasks_from_reminders(uon_id: str, record_kind: str, client_name: str, client_phone: str, manager_name: str):
    """Создаёт/обновляет задачи на канбане по напоминаниям обращения/заявки из
    U-ON — единый путь для request и lead, т.к. /reminder/{id}.json работает
    для обоих (см. флаги in_lead/in_request в самом ответе). В тексте задачи
    всегда указывается номер записи в U-ON и контакты клиента, чтобы можно
    было сразу связаться, не открывая U-ON. Ответственный подбирается по имени
    менеджера (см. _match_manager_user) — не найдено соответствие, значит
    задача остаётся без ответственного.

    Сохраняет uon_record_kind/uon_record_id на самой задаче — по ним строится
    ссылка «Открыть в U-ON» на конкретную запись (см. kanban.serializers,
    telegrambot.services.build_uon_record_url), а не просто на доску. При
    новом назначении ответственного отправляется Telegram-уведомление
    (notify_task_assignment) — так же, как при ручном назначении в CRM."""
    from kanban.models import Task
    from kanban.services import next_order_in_column, reposition_task
    from telegrambot.services import get_first_column, get_last_column
    from telegrambot.tasks import notify_task_assignment

    kind_label = _RECORD_LABELS[record_kind]

    try:
        reminders = get_uon_adapter().list_reminders(uon_id)
    except UonAdapterError as exc:
        logger.warning('U-ON: не удалось получить напоминания для %s %s: %s', kind_label, uon_id, exc)
        return

    first_column = get_first_column()
    last_column = get_last_column()
    if first_column is None:
        logger.warning('U-ON: на доске не настроено ни одной колонки, пропускаем задачи')
        return

    assignee = _match_manager_user(manager_name)
    contact = f'{kind_label} №{uon_id}\nКлиент: {client_name or "—"}\nТелефон: {client_phone or "—"}'

    def _titled(raw_text: str, has_assignee: bool) -> str:
        # По решению заказчика: если у обращения/заявки не выбран менеджер в
        # U-ON, задача не назначается «по умолчанию» ни на кого — вместо этого
        # явно помечается в заголовке, чтобы не потеряться в общем списке без
        # уведомления. Считается по итоговому состоянию задачи (а не только по
        # свежему совпадению из U-ON), чтобы не перезаписать метку у задачи,
        # которую менеджер уже назначил себе вручную прямо в CRM.
        prefix = '' if has_assignee else '⚠️ БЕЗ МЕНЕДЖЕРА · '
        return f'{prefix}№{uon_id}: {raw_text}'[:255]

    for reminder in reminders:
        reminder_id = str(reminder['id'])
        text = reminder.get('text') or f'Напоминание U-ON #{reminder_id}'
        deadline = _parse_uon_datetime(reminder.get('datetime'))
        is_done = bool(reminder.get('is_done'))
        target_column = last_column if (is_done and last_column) else first_column

        task = Task.objects.filter(uon_reminder_id=reminder_id).first()
        if task is None:
            task = Task.objects.create(
                uon_reminder_id=reminder_id, title=_titled(text, bool(assignee)), description=contact,
                deadline=deadline, column=target_column, assignee=assignee,
                order=next_order_in_column(target_column), uon_record_kind=record_kind, uon_record_id=uon_id,
            )
            if assignee:
                notify_task_assignment.delay(task.id)
        else:
            old_assignee_id = task.assignee_id
            if task.column_id != target_column.id:
                reposition_task(task, target_column, next_order_in_column(target_column))
            if assignee:
                task.assignee = assignee
            task.title = _titled(text, bool(task.assignee_id or assignee))
            task.description = contact
            task.deadline = deadline
            task.uon_record_kind = record_kind
            task.uon_record_id = uon_id
            task.save(update_fields=[
                'title', 'description', 'deadline', 'assignee', 'uon_record_kind', 'uon_record_id',
            ])
            if assignee and assignee.id != old_assignee_id:
                notify_task_assignment.delay(task.id)


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
    зеркала «Заявки» в CRM, и для карточек клиентов/туристов (в этом API нет
    отдельного /client-эндпоинта: основной контакт — из client_*-полей заявки,
    а каждый турист, включая самого основного клиента, — из tourists[], самого
    богатого источника данных о человеке, доступного в этом API).

    Вызывается либо вебхуком U-ON (UonWebhookView — событие поступает мгновенно
    при создании/изменении заявки), либо вручную через sync_all_uon_requests."""
    from .models import UonClient, UonRequestRecord

    data = get_uon_adapter().get_request(request_id)
    if not data:
        logger.warning('U-ON: заявка %s не найдена при синхронизации', request_id)
        return False

    client_name = f"{_s(data, 'client_surname')} {_s(data, 'client_name')}".strip()
    client_phone = _s(data, 'client_phone_mobile', 'client_phone')
    client_email = _s(data, 'client_email')

    UonRequestRecord.objects.update_or_create(
        uon_id=str(data['id']),
        defaults={
            'reservation_number': _s(data, 'reservation_number'),
            'client_id': _s(data, 'client_id'),
            'client_name': client_name,
            'client_phone': client_phone,
            'client_email': client_email,
            'status_id': _s(data, 'status_id'),
            'status_name': _s(data, 'status'),
            'manager_name': _s(data, 'manager_name'),
            'source_name': _s(data, 'source'),
            'notes': _s(data, 'notes'),
            'is_archive': bool(data.get('is_archive')),
            'uon_created_at': _parse_uon_datetime(data.get('dat_request') or data.get('created_at')),
            'date_begin': _parse_uon_date(data.get('date_begin')),
            'date_end': _parse_uon_date(data.get('date_end')),
            'raw_data': data,
        },
    )

    client_id = _s(data, 'client_id')
    synced_client_ids = set()
    for tourist in (data.get('tourists') or []):
        tourist_id = _s(tourist, 'u_id')
        if not tourist_id:
            continue
        UonClient.objects.update_or_create(
            uon_id=tourist_id,
            defaults=_client_defaults_from_tourist(tourist, is_main=(tourist_id == client_id)),
        )
        synced_client_ids.add(tourist_id)

    if client_id and client_id not in synced_client_ids:
        UonClient.objects.update_or_create(
            uon_id=client_id,
            defaults=_client_defaults_basic(data, client_name, client_phone, client_email),
        )

    _sync_tasks_from_reminders(str(data['id']), 'request', client_name, client_phone, _s(data, 'manager_name'))

    logger.info(
        'U-ON: заявка %s синхронизирована (%s туристов)', request_id, len(synced_client_ids) or int(bool(client_id)),
    )
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

    client_name = f"{_s(data, 'client_surname')} {_s(data, 'client_name')}".strip()
    client_phone = _s(data, 'client_phone_mobile', 'client_phone')
    client_email = _s(data, 'client_email')

    UonLeadRecord.objects.update_or_create(
        uon_id=str(data['id']),
        defaults={
            'client_id': _s(data, 'client_id'),
            'client_name': client_name,
            'client_phone': client_phone,
            'client_email': client_email,
            'status_id': _s(data, 'status_id'),
            'status_name': _s(data, 'status'),
            'manager_name': _s(data, 'manager_name'),
            'source_name': _s(data, 'source'),
            'notes': _s(data, 'notes'),
            'is_archive': bool(data.get('is_archive')),
            'uon_created_at': _parse_uon_datetime(data.get('dat_lead') or data.get('created_at')),
            'raw_data': data,
        },
    )

    client_id = _s(data, 'client_id')
    if client_id:
        UonClient.objects.update_or_create(
            uon_id=client_id,
            defaults=_client_defaults_basic(data, client_name, client_phone, client_email),
        )

    _sync_tasks_from_reminders(str(data['id']), 'lead', client_name, client_phone, _s(data, 'manager_name'))

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


# --- Цепочка автозадач «клиент молчит после подборки» (см. uonfollowupspec.md) ---
#
# Статус ID 2 «Думает по предложению» подтверждён вручную осмотром кабинета
# (statuses_lead.php) 18.08.2026 — не через GET /status_lead.json, поэтому если
# клиент когда-нибудь переименует/пересоздаст статусы воронки, эту константу
# нужно свериться заново по тому же справочнику.
FOLLOWUP_TRIGGER_STATUS_ID = '2'


def _working_hours(when):
    """Сдвигает момент на ближайшие 09:00 МСК, если он попадает вне окна 09:00–20:00
    (см. uonfollowupspec.md §3.4) — иначе задача, поставленная на «отправлено
    предложение в 22:30», дойдёт до менеджера только следующим утром, и сутки
    будут потеряны зря."""
    local = timezone.localtime(when)
    if 9 <= local.hour < 20:
        return when
    if local.hour < 9:
        target_local = local.replace(hour=9, minute=0, second=0, microsecond=0)
    else:
        target_local = (local + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
    return target_local


def _close_active_chains(lead_id: str, reason: str, close_remote_reminder: bool = False):
    """Гасит все активные цепочки по обращению (в норме их не больше одной —
    unique-ограничение на (lead_id, status_entered_at) не мешает существованию
    нескольких записей для разных «заходов» в статус 2 у одного обращения)."""
    from .models import UonFollowupChain

    from django.conf import settings

    chains = list(UonFollowupChain.objects.filter(lead_id=lead_id, state=UonFollowupChain.State.ACTIVE))
    for chain in chains:
        if close_remote_reminder and chain.reminder_id:
            try:
                get_uon_adapter().close_reminder(
                    chain.reminder_id, done_u_id=getattr(settings, 'UON_DEFAULT_MANAGER_ID', ''),
                )
            except UonAdapterError as exc:
                logger.warning('U-ON followup: не удалось закрыть задачу %s в U-ON: %s', chain.reminder_id, exc)
        chain.state = reason
        chain.last_client_action_at = timezone.now() if reason == 'closed_client_replied' else chain.last_client_action_at
        chain.save(update_fields=['state', 'last_client_action_at', 'updated_at'])
    if chains:
        logger.info('U-ON followup: обращение %s — цепочка закрыта (%s)', lead_id, reason)
        if reason == 'closed_client_replied':
            from leads.models import Lead
            from telegrambot.tasks import notify_lead_client_replied

            our_lead = Lead.objects.filter(uon_ticket_id=lead_id).first()
            if our_lead is not None:
                notify_lead_client_replied.delay(our_lead.id)


def _followup_ids_from_payload(payload: dict) -> str:
    """Payload-поля вебхука не подтверждены на живых данных (никогда не приходил
    реальный вызов) — принимаем любое правдоподобное имя ключа, как и в
    UonWebhookView, вместо того чтобы полагаться на одно конкретное."""
    return str(payload.get('request_id') or payload.get('lead_id') or payload.get('r_id') or payload.get('l_id') or '')


@shared_task
def handle_uon_status_change(payload: dict):
    """Реакция на вебхук type_id=16 «Изменение статуса в обращении» — стартует
    цепочку автозадач при входе в статус FOLLOWUP_TRIGGER_STATUS_ID, гасит при
    выходе из него (клиент согласился, отказался, менеджер сменил стадию вручную)."""
    from .models import UonFollowupChain

    lead_id = _followup_ids_from_payload(payload)
    if not lead_id:
        logger.warning('U-ON followup: вебхук смены статуса без ID обращения: %r', payload)
        return

    status_new = _s(payload, 'status_id_new')
    status_old = _s(payload, 'status_id_old')
    entered_at = _parse_uon_datetime(payload.get('datetime')) or timezone.now()

    if status_new == FOLLOWUP_TRIGGER_STATUS_ID:
        chain, created = UonFollowupChain.objects.get_or_create(
            lead_id=lead_id,
            status_entered_at=entered_at,
            defaults={
                'step': UonFollowupChain.Step.TOUCH_1,
                'next_fire_at': _working_hours(entered_at + timedelta(hours=24)),
                'state': UonFollowupChain.State.ACTIVE,
            },
        )
        if created:
            logger.info('U-ON followup: обращение %s вошло в статус %s, старт цепочки', lead_id, FOLLOWUP_TRIGGER_STATUS_ID)
    elif status_old == FOLLOWUP_TRIGGER_STATUS_ID and status_new != FOLLOWUP_TRIGGER_STATUS_ID:
        _close_active_chains(lead_id, UonFollowupChain.State.CLOSED_STATUS_MOVED, close_remote_reminder=True)


@shared_task
def handle_uon_client_reply(payload: dict):
    """Реакция на вебхук type_id=15 «Отправка сообщения в чате» — единственное
    событие, где U-ON, по данным разведки, отдаёт надёжный признак автора
    (`sender_is_client`). type_id=31 (комментарий) сюда намеренно не заведён:
    достоверного способа определить автора из его payload нет, и гадать хуже,
    чем полагаться на живую перепроверку в advance_followup_chains."""
    from .models import UonFollowupChain

    lead_id = _followup_ids_from_payload(payload)
    if not lead_id or not payload.get('sender_is_client'):
        return
    _close_active_chains(lead_id, UonFollowupChain.State.CLOSED_CLIENT_REPLIED, close_remote_reminder=True)


@shared_task
def handle_uon_chain_close(payload: dict):
    """Реакция на вебхук type_id=27 (смена причины отказа) или 55 (удаление
    обращения) — обращение выходит из работы, цепочка больше не нужна."""
    from .models import UonFollowupChain

    lead_id = _followup_ids_from_payload(payload)
    if not lead_id:
        return
    _close_active_chains(lead_id, UonFollowupChain.State.CLOSED_REFUSED, close_remote_reminder=True)


def _followup_lead_context(data: dict) -> dict:
    """Плейсхолдеры пожеланий клиента — структурные поля обращения, подтверждённые
    на живых данных обращения №226 в ходе разведки кабинета (см. uonfollowupspec.md §1.4).
    Страна отдаётся списком ID (requirements_countries) — расшифровка в название
    страны потребовала бы отдельного справочника, который пока не проверен, поэтому
    сюда попадают сырые ID, а не названия."""
    adults = _s(data, 'tourist_count') or '0'
    children = _s(data, 'tourist_child_count') or '0'
    babies = _s(data, 'tourist_baby_count') or '0'
    composition = f'взр {adults}'
    if children != '0':
        composition += f', дет {children}'
    if babies != '0':
        composition += f', млад {babies}'
    nights_from = _s(data, 'nights_from')
    nights_to = _s(data, 'nights_to')
    nights = f'{nights_from}–{nights_to} ноч.' if (nights_from or nights_to) else '—'
    return {
        'client_name': f"{_s(data, 'client_surname')} {_s(data, 'client_name')}".strip() or '—',
        'client_phone': _s(data, 'client_phone_mobile', 'client_phone') or '—',
        'countries': _s(data, 'requirements_countries') or '—',
        'dates': f"{_s(data, 'date_from') or '—'}–{_s(data, 'date_to') or '—'}",
        'nights': nights,
        'hotel_types': _s(data, 'hotel_types') or '—',
        'nutrition': _s(data, 'nutrition') or '—',
        'composition': composition,
        'budget': _s(data, 'budget') or '—',
        'requirements_note': _s(data, 'requirements_note'),
    }


def _last_touch_text(lead_id: str) -> str:
    """Текст последнего касания (см. uonfollowupspec.md §1.4 — сама подборка
    структурно не хранится, только свободным текстом в request-action)."""
    try:
        actions = get_uon_adapter().list_request_actions(lead_id)
    except UonAdapterError as exc:
        logger.warning('U-ON followup: не удалось получить касания по %s: %s', lead_id, exc)
        return ''
    if not actions:
        return ''
    text = _s(actions[-1], 'text', 'note', 'comment')
    return (text[:150] + '…') if len(text) > 150 else text


_FOLLOWUP_TEMPLATES = {
    0: (  # Step.TOUCH_1
        'Подборка отправлена сутки назад — ответа нет.\n\n'
        'Обращение №{lead_id} · {client_name} · {client_phone}\n'
        'Пожелания: {countries} · {dates} · {nights} · {hotel_types} · {nutrition}\n'
        'Состав: {composition} · Бюджет: {budget}\n'
        '{requirements_note_line}'
        '{last_touch_line}'
        'Что сделать: написать клиенту одним сообщением — назвать один конкретный '
        'вариант из подборки и задать один вопрос.\n'
        'Открыть в U-ON: {uon_url}'
    ),
    1: (  # Step.TOUCH_2
        'Второе касание. Клиент молчит 2 суток после подборки.\n\n'
        'Обращение №{lead_id} · {client_name} · {client_phone}\n'
        'Пожелания: {countries} · {dates} · Бюджет: {budget}\n'
        '{requirements_note_line}\n'
        'Что сделать: сменить канал связи (если писали — позвонить). Дать новую '
        'причину для ответа: изменилась цена / уходят места / появился вариант ближе к бюджету.\n'
        'Открыть в U-ON: {uon_url}'
    ),
    2: (  # Step.ESCALATION
        'Клиент молчит 4 суток. Нужно решение, а не ещё одно напоминание.\n\n'
        'Обращение №{lead_id} · {client_name} · {client_phone}\n'
        'Пожелания: {countries} · {dates} · Бюджет: {budget}\n\n'
        'Выбрать одно: позвонить с новым предложением / перевести в «Потом» / '
        'перевести в «Отвалился» с причиной отказа.\n'
        'Дальше автозадачи по этому обращению создаваться не будут.\n'
        'Открыть в U-ON: {uon_url}'
    ),
}


def _build_followup_text(step: int, data: dict, lead_id: str, uon_url: str) -> str:
    ctx = _followup_lead_context(data)
    ctx['lead_id'] = lead_id
    ctx['uon_url'] = uon_url
    ctx['requirements_note_line'] = f"Пожелания клиента: {ctx['requirements_note']}\n" if ctx['requirements_note'] else ''
    last_touch = _last_touch_text(lead_id) if step == 0 else ''
    ctx['last_touch_line'] = f'Последнее сообщение клиенту: «{last_touch}»\n\n' if last_touch else '\n'
    return _FOLLOWUP_TEMPLATES[step].format(**ctx)


@shared_task
def advance_followup_chains():
    """Периодическая задача (Celery Beat, раз в 5 минут) — продвигает активные
    цепочки автозадач «клиент молчит после подборки» через TOUCH_1 → TOUCH_2 →
    ESCALATION (см. uonfollowupspec.md §3.3). На каждом шаге живьём перечитывает
    обращение из U-ON: если статус уже не FOLLOWUP_TRIGGER_STATUS_ID, цепочка
    гасится без создания новой задачи — так же, как это сделал бы вебхук смены
    статуса, но полагаться только на вебхук нельзя (доставка не гарантирована,
    см. §3.5 запасной путь)."""
    from .models import UonFollowupChain
    from telegrambot.services import build_uon_record_url

    due = list(UonFollowupChain.objects.filter(
        state=UonFollowupChain.State.ACTIVE, next_fire_at__lte=timezone.now(),
    ))
    for chain in due:
        data = get_uon_adapter().get_lead(chain.lead_id)
        if not data or _s(data, 'status_id') != FOLLOWUP_TRIGGER_STATUS_ID:
            reason = UonFollowupChain.State.CLOSED_STATUS_MOVED
            chain.state = reason
            chain.save(update_fields=['state', 'updated_at'])
            continue

        # manager_id/created_u_id документация U-ON помечает необязательными, но их
        # отсутствие подтверждённо роняет reminder/create в 500 (18.08.2026, живой API,
        # проверено трижды, включая заведомо валидную заявку без этих полей). Без
        # разрешимого manager_id создавать напоминание в U-ON нельзя вообще — такое
        # обращение просто останется без дубля в U-ON (см. _titled в
        # _sync_tasks_from_reminders — на канбане такая задача и так не назначается
        # никому «по умолчанию», это то же самое ограничение с другой стороны).
        from django.conf import settings

        manager_id = _s(data, 'manager_id') or getattr(settings, 'UON_DEFAULT_MANAGER_ID', '')
        if not manager_id:
            logger.warning(
                'U-ON followup: у обращения %s нет менеджера и не задан '
                'UON_DEFAULT_MANAGER_ID — пропускаю создание напоминания в U-ON (шаг %s)',
                chain.lead_id, chain.step,
            )
            continue  # next_fire_at не сдвигаем — попробуем на следующем проходе планировщика

        uon_url = build_uon_record_url('lead', chain.lead_id)
        text = _build_followup_text(chain.step, data, chain.lead_id, uon_url)
        now_local = timezone.localtime(timezone.now())
        reminder_payload = {
            'r_id': chain.lead_id,
            'type_id': '1',
            'datetime': now_local.strftime('%Y-%m-%d %H:%M:%S'),
            'datetime_to': (now_local + timedelta(minutes=30)).strftime('%Y-%m-%d %H:%M:%S'),
            'text': text,
            'manager_id': manager_id,
            'created_u_id': manager_id,
        }
        try:
            response = get_uon_adapter().create_reminder(reminder_payload)
        except UonAdapterError as exc:
            logger.warning(
                'U-ON followup: не удалось создать задачу по %s (шаг %s): %s', chain.lead_id, chain.step, exc,
            )
            continue  # next_fire_at не сдвигаем — попробуем на следующем проходе планировщика

        chain.reminder_id = str(response.get('id', ''))
        if chain.step == UonFollowupChain.Step.TOUCH_1:
            chain.step = UonFollowupChain.Step.TOUCH_2
            chain.next_fire_at = _working_hours(chain.status_entered_at + timedelta(hours=48))
        elif chain.step == UonFollowupChain.Step.TOUCH_2:
            chain.step = UonFollowupChain.Step.ESCALATION
            chain.next_fire_at = _working_hours(chain.status_entered_at + timedelta(hours=96))
        else:
            chain.state = UonFollowupChain.State.CLOSED_ESCALATED
        chain.save(update_fields=['reminder_id', 'step', 'next_fire_at', 'state', 'updated_at'])

        # Переиспользует существующий путь подтяжки напоминаний на канбан +
        # уведомление в Telegram (_sync_tasks_from_reminders) вместо того, чтобы
        # дублировать создание локальной задачи отдельным кодом.
        sync_uon_lead.delay(chain.lead_id)

    logger.info('U-ON followup: обработано цепочек: %s', len(due))


_UON_SOURCE_MAP = {
    '7': 'chatbot',
}


@shared_task
def handle_uon_task_added(payload: dict):
    """Событие U-ON «Добавление задачи» (type_id=34).

    Payload вебхука содержит обращение (request[...]) и клиента (client[...])
    целиком, поэтому лид и задача создаются напрямую, без запросов в API U-ON.
    Повторная доставка того же вебхука дублей не создаёт.
    """
    from kanban.models import Task
    from kanban.services import next_order_in_column
    from leads.models import Lead
    from telegrambot.services import get_first_column

    def g(*keys):
        for key in keys:
            value = payload.get(key)
            if value not in (None, ''):
                return str(value).strip()
        return ''

    uon_ticket_id = g('request[r_id]', 'r_id', 'request_id')
    reminder_id = g('reminder_id')
    if uon_ticket_id in ('', '0') or not reminder_id:
        logger.warning('U-ON task: нет r_id или reminder_id, пропускаем: %s', payload)
        return False

    name = ' '.join(p for p in (g('client[u_surname]'), g('client[u_name]')) if p)
    lead, lead_created = Lead.objects.get_or_create(
        uon_ticket_id=uon_ticket_id,
        defaults={
            'name': name or 'Обращение U-ON #%s' % uon_ticket_id,
            'phone': g('client[u_phone_mobile]', 'client[u_phone]'),
            'email': g('client[u_email]'),
            'source': _UON_SOURCE_MAP.get(g('request[source_id]'), 'other'),
            'initial_comment': g('client[u_note]'),
        },
    )

    column = get_first_column()
    if column is None:
        logger.warning('U-ON task: на доске не настроено ни одной колонки, пропускаем')
        return False

    title = (g('text') or 'Напоминание U-ON #%s' % reminder_id)[:255]
    deadline = _parse_uon_datetime(g('date_from_msk', 'date_from'))

    task = Task.objects.filter(uon_reminder_id=reminder_id).first()
    if task is None:
        task = Task.objects.create(
            uon_reminder_id=reminder_id,
            title=title,
            lead=lead,
            column=column,
            deadline=deadline,
            assignee=lead.assigned_manager,
            order=next_order_in_column(column),
            uon_record_kind='lead',
            uon_record_id=uon_ticket_id,
        )
        task_created = True
    else:
        Task.objects.filter(pk=task.pk).update(
            title=title, deadline=deadline, lead=lead,
            uon_record_kind='lead', uon_record_id=uon_ticket_id,
        )
        task_created = False

    logger.info(
        'U-ON task: лид #%s (%s), задача #%s (%s), напоминание %s',
        lead.pk, 'создан' if lead_created else 'уже был',
        task.pk, 'создана' if task_created else 'обновлена', reminder_id,
    )
    if task_created:
        from telegrambot.tasks import notify_task_created
        notify_task_created.delay(task.pk)


DOCUMENT_ISSUANCE_LEAD_DAYS = 5
_DOCS_TITLE_PREFIX = '📄 Выдать документы'


@shared_task
def check_document_issuance_deadlines():
    """Раз в день (см. CELERY_BEAT_SCHEDULE) — заявки (сделки, не обращения — у них
    есть подтверждённая дата вылета) с датой вылета ровно через
    DOCUMENT_ISSUANCE_LEAD_DAYS дней получают задачу «выдать документы».
    Идемпотентно, как и check_stale_leads в leads.tasks: проверка по префиксу
    заголовка + uon_record_id, повторно не создаём, пока прежняя задача открыта."""
    from kanban.models import Task
    from kanban.services import next_order_in_column
    from telegrambot.services import get_first_column, get_last_column
    from telegrambot.tasks import notify_task_created

    from .models import UonRequestRecord

    target_date = timezone.localdate() + timedelta(days=DOCUMENT_ISSUANCE_LEAD_DAYS)
    requests = UonRequestRecord.objects.filter(date_begin=target_date, is_archive=False)

    column = get_first_column()
    last_column = get_last_column()
    if column is None:
        logger.warning('На доске не настроено ни одной колонки, проверка выдачи документов пропущена')
        return

    created = 0
    for record in requests:
        existing = Task.objects.filter(
            uon_record_kind='request', uon_record_id=record.uon_id, title__startswith=_DOCS_TITLE_PREFIX,
        )
        if last_column is not None:
            existing = existing.exclude(column=last_column)
        if existing.exists():
            continue

        assignee = _match_manager_user(record.manager_name)
        # ФИО/телефон — только в description (виден в CRM), не в title (уходит
        # в Telegram целиком, см. telegrambot.services.format_task_line; ТЗ 11.5, 152-ФЗ).
        title_prefix = _DOCS_TITLE_PREFIX if assignee else f'{_DOCS_TITLE_PREFIX} ⚠️ БЕЗ МЕНЕДЖЕРА'
        title = f'{title_prefix} №{record.uon_id}'
        description = (
            f'Заявка №{record.uon_id}\nКлиент: {record.client_name or "—"}\n'
            f'Телефон: {record.client_phone or "—"}\nВылет: {record.date_begin:%d.%m.%Y}'
        )
        task = Task.objects.create(
            title=title, description=description, column=column, assignee=assignee,
            order=next_order_in_column(column), uon_record_kind='request', uon_record_id=record.uon_id,
        )
        notify_task_created.delay(task.pk)
        created += 1

    logger.info(
        'Проверка выдачи документов (%s): создано задач — %s', target_date, created,
    )
    return created
    return True
