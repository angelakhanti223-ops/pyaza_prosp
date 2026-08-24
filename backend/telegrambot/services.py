"""Форматирование сообщений и ссылок для бота.

ФИО клиента показывается в сообщениях (решение заказчика, 24.08.2026, —
осознанный откат более раннего запрета по ТЗ 11.5/152-ФЗ); телефон/email
по-прежнему не выводятся — ссылка на карточку в веб-CRM или в U-ON, где есть
полные контакты, выводится отдельной кнопкой (см. bot.py), а не текстом.

Модели kanban/leads импортируются лениво внутри функций (а не на уровне
модуля), как это сделано в integrations/tasks.py — этот модуль используется
и из Celery-задач, и из хендлеров бота, которые могут импортироваться Django
раньше, чем полностью готов реестр приложений.
"""
import html as html_lib

from django.conf import settings


def build_lead_url(lead_id: int) -> str:
    return f'{settings.SITE_URL}/crm/leads/{lead_id}'


def build_board_url() -> str:
    return f'{settings.SITE_URL}/crm/kanban'


def build_uon_record_url(record_kind: str, uon_id: str) -> str:
    """Прямая ссылка на карточку заявки/обращения в самом кабинете U-ON (не в нашей
    CRM) — см. kanban.Task.uon_record_kind/uon_record_id. Подтверждено клиентом:
    один и тот же адрес для заявок и обращений, меняется только r_id."""
    del record_kind  # пока один и тот же путь для обоих типов, см. docstring
    return f'{settings.UON_CABINET_URL}/request_edit_lead.php?r_id={uon_id}'


def is_local_url(url: str) -> bool:
    """Telegram отклоняет inline-кнопки со ссылкой на localhost/127.0.0.1
    ("wrong http url") — типичная ситуация в dev-окружении, пока сайт не
    задеплоен на реальный домен. Такие ссылки не оборачиваем в кнопку."""
    return url.startswith('http://localhost') or url.startswith('http://127.0.0.1')


def get_first_column():
    from kanban.models import KanbanColumn

    return KanbanColumn.objects.order_by('order').first()


def get_last_column():
    from kanban.models import KanbanColumn

    return KanbanColumn.objects.order_by('-order').first()


def escape_html(value: str) -> str:
    return html_lib.escape(value or '')


def resolve_task_client_name(task) -> str | None:
    """ФИО клиента по задаче: напрямую из привязанного Lead, либо (для задач,
    заведённых из напоминаний U-ON) из зеркала обращения/заявки по
    uon_record_kind/uon_record_id — у самой Task такого поля нет."""
    if task.lead_id:
        return task.lead.name if task.lead else None
    if task.uon_record_kind and task.uon_record_id:
        if task.uon_record_kind == 'request':
            from integrations.models import UonRequestRecord

            record = UonRequestRecord.objects.filter(uon_id=task.uon_record_id).first()
        else:
            from integrations.models import UonLeadRecord

            record = UonLeadRecord.objects.filter(uon_id=task.uon_record_id).first()
        return record.client_name if record and record.client_name else None
    return None


def format_task_line(task) -> str:
    deadline = task.deadline.strftime('%d.%m.%Y %H:%M') if task.deadline else 'без срока'
    lines = [f'📌 <b>{escape_html(task.title)}</b>']
    client_name = resolve_task_client_name(task)
    if client_name:
        lines.append(f'👤 {escape_html(client_name)}')
    lines.append(f'{escape_html(task.column.name)} · до {deadline}')
    return '\n'.join(lines)


def format_lead_summary(lead) -> str:
    lines = [
        f'📋 Заявка #{lead.id}',
        f'ФИО: <b>{escape_html(lead.name)}</b>',
        f'Статус: <b>{escape_html(lead.get_status_display())}</b>',
        f'Направление: {escape_html(lead.direction.name) if lead.direction_id else "—"}',
    ]
    if lead.deal_amount is not None:
        lines.append(f'Сумма сделки: {lead.deal_amount} ₽')
    return '\n'.join(lines)


MONTH_NAMES_RU = {
    1: 'январь', 2: 'февраль', 3: 'март', 4: 'апрель', 5: 'май', 6: 'июнь',
    7: 'июль', 8: 'август', 9: 'сентябрь', 10: 'октябрь', 11: 'ноябрь', 12: 'декабрь',
}


def format_money(value) -> str:
    return f'{float(value):,.0f} ₽'.replace(',', ' ')


def format_plan_summary(year: int, month: int, rows: list, target_total, actual_total) -> str:
    """План/факт по комиссии менеджеров — общий формат для /plan в боте и
    еженедельной рассылки (см. telegrambot.tasks.notify_weekly_plan_progress)."""
    month_label = MONTH_NAMES_RU.get(month, str(month))
    if not rows:
        return f'📊 План на {month_label} {year} не задан.'

    lines = [f'📊 <b>План на {month_label} {year}</b>']
    for row in rows:
        percent = row['percent']
        icon = '✅' if percent >= 100 else ('🟡' if percent >= 70 else '🔴')
        lines.append(
            f"{icon} {escape_html(row['manager_name'])}: "
            f"{format_money(row['actual'])} / {format_money(row['target'])} ({percent}%)"
        )

    if len(rows) > 1:
        total_percent = round(float(actual_total) / float(target_total) * 100, 1) if target_total else 0
        lines.append(f'\n<b>Итого офис:</b> {format_money(actual_total)} / {format_money(target_total)} ({total_percent}%)')

    return '\n'.join(lines)


def format_request_summary(record) -> str:
    lines = [f'🧾 Заявка №{record.uon_id}']
    if record.client_name:
        lines.append(f'ФИО: <b>{escape_html(record.client_name)}</b>')
    lines.append(f'Статус: <b>{escape_html(record.status_name) if record.status_name else "Без статуса"}</b>')
    if record.date_begin:
        lines.append(f'Вылет: {record.date_begin.strftime("%d.%m.%Y")}')
    return '\n'.join(lines)


def format_work_summary(data: dict) -> str:
    """Обращения (Lead) и заявки (U-ON) в работе — общий формат для /summary
    в боте и панели «Сводка» в CRM (см. leads.dashboard.work_summary_data)."""
    lines = [f"📁 <b>Обращения в работе</b> — {data['leads_total']}"]
    for row in data['leads_by_status']:
        if row['count']:
            lines.append(f"  {escape_html(row['status_display'])}: {row['count']}")

    lines.append('')
    lines.append(f"🧾 <b>Заявки в работе</b> — {data['requests_total']}")
    if not data['requests_by_status']:
        lines.append('  Нет заявок в работе')
    for row in data['requests_by_status']:
        lines.append(f"  {escape_html(row['status_name'])}: {row['count']}")

    return '\n'.join(lines)
