"""Форматирование сообщений и ссылок для бота.

Сообщения намеренно не содержат ФИО/телефон/email клиента (ТЗ 11.5, 152-ФЗ) —
только статус/направление/дедлайн; ссылка на карточку в веб-CRM выводится
отдельной кнопкой (см. bot.py), а не текстом.

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


def format_task_line(task) -> str:
    deadline = task.deadline.strftime('%d.%m.%Y %H:%M') if task.deadline else 'без срока'
    return (
        f'📌 <b>{escape_html(task.title)}</b>\n'
        f'{escape_html(task.column.name)} · до {deadline}'
    )


def format_lead_summary(lead) -> str:
    lines = [
        f'📋 Заявка #{lead.id}',
        f'Статус: <b>{escape_html(lead.get_status_display())}</b>',
        f'Направление: {escape_html(lead.direction.name) if lead.direction_id else "—"}',
    ]
    if lead.deal_amount is not None:
        lines.append(f'Сумма сделки: {lead.deal_amount} ₽')
    return '\n'.join(lines)
