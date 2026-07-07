import logging
from datetime import datetime as dt

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
    try:
        naive = dt.strptime(value, '%Y-%m-%d %H:%M')
    except ValueError:
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

    for reminder in reminders:
        reminder_id = str(reminder['id'])
        text = reminder.get('text') or f'Напоминание U-ON #{reminder_id}'
        title = f'№{uon_id}: {text}'[:255]
        deadline = _parse_uon_datetime(reminder.get('datetime'))
        is_done = bool(reminder.get('is_done'))
        target_column = last_column if (is_done and last_column) else first_column

        task = Task.objects.filter(uon_reminder_id=reminder_id).first()
        if task is None:
            task = Task.objects.create(
                uon_reminder_id=reminder_id, title=title, description=contact, deadline=deadline,
                column=target_column, assignee=assignee, order=next_order_in_column(target_column),
                uon_record_kind=record_kind, uon_record_id=uon_id,
            )
            if assignee:
                notify_task_assignment.delay(task.id)
        else:
            old_assignee_id = task.assignee_id
            if task.column_id != target_column.id:
                reposition_task(task, target_column, next_order_in_column(target_column))
            task.title = title
            task.description = contact
            task.deadline = deadline
            task.uon_record_kind = record_kind
            task.uon_record_id = uon_id
            if assignee:
                task.assignee = assignee
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
