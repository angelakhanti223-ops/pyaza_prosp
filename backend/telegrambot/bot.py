"""Обработчики команд и inline-кнопок бота (python-telegram-bot, long polling —
см. management/commands/run_telegram_bot.py).

Все обращения к Django ORM обёрнуты в sync_to_async, так как ORM Django
синхронный, а PTB v21+ работает на asyncio.
"""
import logging
from datetime import timedelta

from asgiref.sync import sync_to_async
from django.conf import settings
from django.utils import timezone
from telegram import BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, ContextTypes

from accounts.permissions import is_head

from .models import TelegramAccount
from .services import (
    build_board_url,
    build_lead_url,
    escape_html,
    format_lead_summary,
    format_task_line,
    get_first_column,
    get_last_column,
    is_local_url,
)

logger = logging.getLogger('telegrambot')

# /tasks раньше слало одно сообщение НА КАЖДУЮ задачу — при полусотне открытых
# задач (обычное дело на этой доске) чат превращался в стену карточек. Теперь
# сначала сводка по срокам (см. _task_category), потом компактный список по
# TASKS_PAGE_SIZE штук на странице с кнопками пагинации и «✅» прямо в строке.
TASKS_PAGE_SIZE = 5

_CATEGORY_LABELS = {
    'overdue': '🔴 Просрочено',
    'today': '🟡 Сегодня',
    'week': '🔵 Эта неделя',
    'later': '🟣 Позже',
    'no_deadline': '⚪ Без срока',
}
_CATEGORY_ORDER = ['overdue', 'today', 'week', 'later', 'no_deadline']

# /leads — тот же приём сводка→категория→список, что и /tasks, но по срочности
# заявки, а не по сроку (решение заказчика, 19.08.2026): без движения дольше
# LEADS_STALE_DAYS — тревожнее, чем сам статус воронки.
LEADS_STALE_DAYS = 3

_LEAD_CATEGORY_LABELS = {
    'stale': '🔴 Без движения 3+ дня',
    'new': '🟡 Новые, не в работе',
    'booked_unpaid': '🟠 Бронь без оплаты',
    'active': '🔵 В работе',
    'other': '⚪ Остальное',
}
_LEAD_CATEGORY_ORDER = ['stale', 'new', 'booked_unpaid', 'active', 'other']

NOT_LINKED_TEXT = 'Аккаунт не привязан. Обратитесь к руководителю за кодом (/start &lt;код&gt;).'

HELP_TEXT = (
    '<b>Доступные команды</b>\n'
    '/tasks — мои открытые задачи\n'
    '/leads — мои заявки\n'
    '/newtask &lt;текст&gt; — создать задачу\n'
    '/done &lt;номер&gt; — отметить задачу выполненной\n'
    '/lead &lt;номер&gt; — карточка заявки\n'
    '/sync_uon &lt;номер&gt; — подтянуть напоминания из U-ON\n'
    '/menu — главное меню'
)

MAIN_MENU_KEYBOARD = InlineKeyboardMarkup([
    [InlineKeyboardButton('📋 Мои задачи', callback_data='menu:tasks')],
    [InlineKeyboardButton('📁 Мои заявки', callback_data='menu:leads')],
    [InlineKeyboardButton('ℹ️ Все команды', callback_data='menu:help')],
])


def _url_row(label: str, url: str):
    """Строка с URL-кнопкой, либо None, если ссылка ведёт на localhost (см. is_local_url)."""
    if is_local_url(url):
        return None
    return [InlineKeyboardButton(label, url=url)]


def task_keyboard(task) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton('✅ Готово', callback_data=f'done:{task.id}')]]
    url = build_lead_url(task.lead_id) if task.lead_id else build_board_url()
    row = _url_row('🔗 Открыть в CRM', url)
    if row:
        rows.append(row)
    return InlineKeyboardMarkup(rows)


def lead_keyboard(lead) -> InlineKeyboardMarkup:
    rows = []
    row = _url_row('🔗 Открыть в CRM', build_lead_url(lead.id))
    if row:
        rows.append(row)
    if lead.uon_ticket_id:
        rows.append([InlineKeyboardButton('🔄 Синхронизировать с U-ON', callback_data=f'sync:{lead.id}')])
    return InlineKeyboardMarkup(rows)


async def _reply(update: Update, context: ContextTypes.DEFAULT_TYPE, text: str, keyboard=None):
    await context.bot.send_message(
        chat_id=update.effective_chat.id, text=text, reply_markup=keyboard,
        parse_mode=ParseMode.HTML, disable_web_page_preview=True,
    )


@sync_to_async
def _get_account(chat_id: int):
    return TelegramAccount.objects.select_related('user').filter(chat_id=chat_id, is_active=True).first()


@sync_to_async
def _find_account_by_code(code: str):
    return TelegramAccount.objects.filter(link_code=code).first()


@sync_to_async
def _link_account(account: TelegramAccount, chat_id: int, username: str):
    account.chat_id = chat_id
    account.telegram_username = username or ''
    account.linked_at = timezone.now()
    account.save(update_fields=['chat_id', 'telegram_username', 'linked_at'])


def _task_category(task, today) -> str:
    if not task.deadline:
        return 'no_deadline'
    deadline_date = timezone.localtime(task.deadline).date()
    if deadline_date < today:
        return 'overdue'
    if deadline_date == today:
        return 'today'
    if deadline_date <= today + timedelta(days=6):
        return 'week'
    return 'later'


@sync_to_async
def _load_task_buckets(user):
    """Все открытые задачи пользователя, разложенные по категориям срока —
    одним запросом в базу (десятки задач на менеджера, не тысячи, поэтому
    раскладка по корзинам в памяти дешевле, чем считать по категориям отдельно)."""
    from kanban.models import Task

    last_column = get_last_column()
    qs = Task.objects.select_related('column', 'lead').filter(assignee=user)
    if last_column:
        qs = qs.exclude(column=last_column)
    tasks = list(qs.order_by('column__order', 'order'))

    today = timezone.localdate()
    buckets = {category: [] for category in _CATEGORY_ORDER}
    for task in tasks:
        buckets[_task_category(task, today)].append(task)
    return buckets


def _format_summary_text(buckets: dict) -> str:
    total = sum(len(v) for v in buckets.values())
    if total == 0:
        return '🎉 Открытых задач нет.'
    lines = [f'📋 Ваши задачи: {total} открытых', '']
    for category in _CATEGORY_ORDER:
        count = len(buckets[category])
        if count:
            lines.append(f'{_CATEGORY_LABELS[category]} — {count}')
    return '\n'.join(lines)


def _summary_keyboard(buckets: dict) -> InlineKeyboardMarkup | None:
    rows = [
        [InlineKeyboardButton(f'{_CATEGORY_LABELS[category]} ({len(buckets[category])})', callback_data=f'cat:{category}:1')]
        for category in _CATEGORY_ORDER
        if buckets[category]
    ]
    return InlineKeyboardMarkup(rows) if rows else None


def _format_list_line(index: int, task) -> str:
    title = task.title if len(task.title) <= 60 else task.title[:57] + '…'
    if task.deadline:
        return f'{index}. {escape_html(title)} — до {timezone.localtime(task.deadline).strftime("%d.%m")}'
    return f'{index}. {escape_html(title)}'


def _category_list_text(category: str, page_tasks: list, page: int, total_pages: int, total: int) -> str:
    lines = [f'{_CATEGORY_LABELS[category]} — {total}', '']
    lines.extend(_format_list_line(i, task) for i, task in enumerate(page_tasks, start=1))
    if total_pages > 1:
        lines.append(f'\nСтраница {page} из {total_pages}')
    return '\n'.join(lines)


def _category_list_keyboard(category: str, page_tasks: list, page: int, total_pages: int) -> InlineKeyboardMarkup:
    rows = []
    if page_tasks:
        rows.append([
            InlineKeyboardButton(f'✅ {i}', callback_data=f'donelist:{task.id}:{category}:{page}')
            for i, task in enumerate(page_tasks, start=1)
        ])
    nav_row = []
    if page > 1:
        nav_row.append(InlineKeyboardButton('◀ Пред', callback_data=f'cat:{category}:{page - 1}'))
    if page < total_pages:
        nav_row.append(InlineKeyboardButton('След ▶', callback_data=f'cat:{category}:{page + 1}'))
    if nav_row:
        rows.append(nav_row)
    rows.append([InlineKeyboardButton('🔙 К сводке', callback_data='menu:tasks')])
    return InlineKeyboardMarkup(rows)


def _lead_category(lead, today) -> str:
    from leads.models import Lead

    days_since_update = (today - timezone.localtime(lead.updated_at).date()).days
    if days_since_update >= LEADS_STALE_DAYS:
        return 'stale'
    if lead.status == Lead.Status.NEW:
        return 'new'
    if lead.status == Lead.Status.BOOKED:
        return 'booked_unpaid'
    if lead.status == Lead.Status.IN_PROGRESS:
        return 'active'
    return 'other'


@sync_to_async
def _load_lead_buckets(user):
    """Открытые заявки менеджера, разложенные по категориям срочности (не по
    статусу воронки — «без движения» важнее для внимания, чем сама стадия)."""
    from leads.models import Lead

    leads = list(
        Lead.objects.filter(assigned_manager=user)
        .exclude(status__in=[Lead.Status.CLOSED_WON, Lead.Status.CLOSED_LOST])
        .order_by('-updated_at'),
    )
    today = timezone.localdate()
    buckets = {category: [] for category in _LEAD_CATEGORY_ORDER}
    for lead in leads:
        buckets[_lead_category(lead, today)].append(lead)
    return buckets


def _format_lead_summary_text(buckets: dict) -> str:
    total = sum(len(v) for v in buckets.values())
    if total == 0:
        return '🎉 Открытых заявок нет.'
    lines = [f'📁 Ваши заявки: {total} открытых', '']
    for category in _LEAD_CATEGORY_ORDER:
        count = len(buckets[category])
        if count:
            lines.append(f'{_LEAD_CATEGORY_LABELS[category]} — {count}')
    return '\n'.join(lines)


def _lead_summary_keyboard(buckets: dict) -> InlineKeyboardMarkup | None:
    rows = [
        [InlineKeyboardButton(
            f'{_LEAD_CATEGORY_LABELS[category]} ({len(buckets[category])})', callback_data=f'leadcat:{category}:1',
        )]
        for category in _LEAD_CATEGORY_ORDER
        if buckets[category]
    ]
    return InlineKeyboardMarkup(rows) if rows else None


def _format_lead_list_line(index: int, lead) -> str:
    # Без ФИО/телефона — только номер и статус (ТЗ 11.5, 152-ФЗ), как и в
    # format_lead_summary для карточки одной заявки.
    return f'{index}. №{lead.id} — {escape_html(lead.get_status_display())}'


def _lead_category_list_text(category: str, page_leads: list, page: int, total_pages: int, total: int) -> str:
    lines = [f'{_LEAD_CATEGORY_LABELS[category]} — {total}', '']
    lines.extend(_format_lead_list_line(i, lead) for i, lead in enumerate(page_leads, start=1))
    if total_pages > 1:
        lines.append(f'\nСтраница {page} из {total_pages}')
    return '\n'.join(lines)


def _lead_category_list_keyboard(category: str, page_leads: list, page: int, total_pages: int) -> InlineKeyboardMarkup:
    rows = []
    if page_leads:
        rows.append([
            InlineKeyboardButton(str(i), callback_data=f'leadopen:{lead.id}:{category}:{page}')
            for i, lead in enumerate(page_leads, start=1)
        ])
    nav_row = []
    if page > 1:
        nav_row.append(InlineKeyboardButton('◀ Пред', callback_data=f'leadcat:{category}:{page - 1}'))
    if page < total_pages:
        nav_row.append(InlineKeyboardButton('След ▶', callback_data=f'leadcat:{category}:{page + 1}'))
    if nav_row:
        rows.append(nav_row)
    rows.append([InlineKeyboardButton('🔙 К сводке', callback_data='menu:leads')])
    return InlineKeyboardMarkup(rows)


@sync_to_async
def _create_task(user, title: str):
    from kanban.models import Task
    from kanban.services import next_order_in_column

    column = get_first_column()
    if column is None:
        return None
    return Task.objects.create(title=title, column=column, assignee=user, order=next_order_in_column(column))


@sync_to_async
def _mark_done(user, task_id: int):
    from django.db.models import Max

    from kanban.models import Task
    from kanban.services import reposition_task

    qs = Task.objects.select_related('column')
    if not is_head(user):
        qs = qs.filter(assignee=user)
    task = qs.filter(pk=task_id).first()
    if task is None:
        return None

    last_column = get_last_column()
    if last_column is None:
        return None

    target_order = (Task.objects.filter(column=last_column).aggregate(m=Max('order'))['m'] or -1) + 1
    reposition_task(task, last_column, target_order)
    return task


@sync_to_async
def _get_lead(user, lead_id: int):
    from leads.models import Lead

    qs = Lead.objects.select_related('direction')
    if not is_head(user):
        qs = qs.filter(assigned_manager=user)
    return qs.filter(pk=lead_id).first()


@sync_to_async
def _get_lead_with_uon(user, lead_id: int):
    from leads.models import Lead

    qs = Lead.objects.all()
    if not is_head(user):
        qs = qs.filter(assigned_manager=user)
    return qs.filter(pk=lead_id).first()


async def _send_task_summary(update: Update, context: ContextTypes.DEFAULT_TYPE, account: TelegramAccount, edit: bool = False):
    buckets = await _load_task_buckets(account.user)
    text = _format_summary_text(buckets)
    keyboard = _summary_keyboard(buckets)
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    else:
        await _reply(update, context, text, keyboard=keyboard)


async def _send_category_page(
    update: Update, context: ContextTypes.DEFAULT_TYPE, account: TelegramAccount,
    category: str, page: int, edit: bool = False,
):
    buckets = await _load_task_buckets(account.user)
    all_tasks = buckets.get(category, [])
    total = len(all_tasks)
    total_pages = max(1, -(-total // TASKS_PAGE_SIZE))  # ceil division
    page = min(max(page, 1), total_pages)
    start = (page - 1) * TASKS_PAGE_SIZE
    page_tasks = all_tasks[start:start + TASKS_PAGE_SIZE]

    if total == 0:
        text = f'{_CATEGORY_LABELS.get(category, category)}\n\nЗдесь пусто — всё разобрано.'
        keyboard = InlineKeyboardMarkup([[InlineKeyboardButton('🔙 К сводке', callback_data='menu:tasks')]])
    else:
        text = _category_list_text(category, page_tasks, page, total_pages, total)
        keyboard = _category_list_keyboard(category, page_tasks, page, total_pages)

    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    else:
        await _reply(update, context, text, keyboard=keyboard)


async def _send_lead_summary(update: Update, context: ContextTypes.DEFAULT_TYPE, account: TelegramAccount, edit: bool = False):
    buckets = await _load_lead_buckets(account.user)
    text = _format_lead_summary_text(buckets)
    keyboard = _lead_summary_keyboard(buckets)
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    else:
        await _reply(update, context, text, keyboard=keyboard)


async def _send_lead_category_page(
    update: Update, context: ContextTypes.DEFAULT_TYPE, account: TelegramAccount,
    category: str, page: int, edit: bool = False,
):
    buckets = await _load_lead_buckets(account.user)
    all_leads = buckets.get(category, [])
    total = len(all_leads)
    total_pages = max(1, -(-total // TASKS_PAGE_SIZE))
    page = min(max(page, 1), total_pages)
    start = (page - 1) * TASKS_PAGE_SIZE
    page_leads = all_leads[start:start + TASKS_PAGE_SIZE]

    if total == 0:
        text = f'{_LEAD_CATEGORY_LABELS.get(category, category)}\n\nЗдесь пусто.'
        keyboard = InlineKeyboardMarkup([[InlineKeyboardButton('🔙 К сводке', callback_data='menu:leads')]])
    else:
        text = _lead_category_list_text(category, page_leads, page, total_pages, total)
        keyboard = _lead_category_list_keyboard(category, page_leads, page, total_pages)

    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    else:
        await _reply(update, context, text, keyboard=keyboard)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await _reply(update, context, 'Чтобы привязать аккаунт, отправьте код, который вам выдал руководитель: /start &lt;код&gt;')
        return

    account = await _find_account_by_code(context.args[0])
    if account is None:
        await _reply(update, context, 'Код не найден. Уточните код у руководителя.')
        return
    if account.chat_id is not None:
        await _reply(update, context, 'Этот код уже использован. Попросите руководителя выдать новый.')
        return

    await _link_account(account, update.effective_chat.id, update.effective_user.username)
    await _reply(update, context, '✅ Аккаунт привязан! Выберите действие:', keyboard=MAIN_MENU_KEYBOARD)


async def cmd_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    account = await _get_account(update.effective_chat.id)
    if account is None:
        await _reply(update, context, NOT_LINKED_TEXT)
        return
    await _reply(update, context, 'Главное меню:', keyboard=MAIN_MENU_KEYBOARD)


async def cmd_tasks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    account = await _get_account(update.effective_chat.id)
    if account is None:
        await _reply(update, context, NOT_LINKED_TEXT)
        return
    await _send_task_summary(update, context, account)


async def cmd_leads(update: Update, context: ContextTypes.DEFAULT_TYPE):
    account = await _get_account(update.effective_chat.id)
    if account is None:
        await _reply(update, context, NOT_LINKED_TEXT)
        return
    await _send_lead_summary(update, context, account)


async def cmd_newtask(update: Update, context: ContextTypes.DEFAULT_TYPE):
    account = await _get_account(update.effective_chat.id)
    if account is None:
        await _reply(update, context, NOT_LINKED_TEXT)
        return

    title = ' '.join(context.args).strip()
    if not title:
        await _reply(update, context, 'Использование: /newtask &lt;название задачи&gt;')
        return

    task = await _create_task(account.user, title)
    if task is None:
        await _reply(update, context, 'На доске не настроено ни одной колонки — обратитесь к руководителю.')
        return

    row = _url_row('🔗 Открыть доску', build_board_url())
    keyboard = InlineKeyboardMarkup([row]) if row else None
    await _reply(update, context, f'✅ Задача «{escape_html(task.title)}» создана.', keyboard=keyboard)


async def cmd_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    account = await _get_account(update.effective_chat.id)
    if account is None:
        await _reply(update, context, NOT_LINKED_TEXT)
        return

    if not context.args or not context.args[0].isdigit():
        await _reply(update, context, 'Использование: /done &lt;номер задачи&gt;')
        return

    task = await _mark_done(account.user, int(context.args[0]))
    if task is None:
        await _reply(update, context, 'Задача не найдена.')
        return

    await _reply(update, context, f'✅ Задача «{escape_html(task.title)}» отмечена как выполненная.')


async def cmd_lead(update: Update, context: ContextTypes.DEFAULT_TYPE):
    account = await _get_account(update.effective_chat.id)
    if account is None:
        await _reply(update, context, NOT_LINKED_TEXT)
        return

    if not context.args or not context.args[0].isdigit():
        await _reply(update, context, 'Использование: /lead &lt;номер заявки&gt;')
        return

    lead = await _get_lead(account.user, int(context.args[0]))
    if lead is None:
        await _reply(update, context, 'Заявка не найдена.')
        return

    await _reply(update, context, format_lead_summary(lead), keyboard=lead_keyboard(lead))


async def cmd_sync_uon(update: Update, context: ContextTypes.DEFAULT_TYPE):
    account = await _get_account(update.effective_chat.id)
    if account is None:
        await _reply(update, context, NOT_LINKED_TEXT)
        return

    if not context.args or not context.args[0].isdigit():
        await _reply(update, context, 'Использование: /sync_uon &lt;номер заявки&gt;')
        return

    lead = await _get_lead_with_uon(account.user, int(context.args[0]))
    if lead is None:
        await _reply(update, context, 'Заявка не найдена.')
        return
    if not lead.uon_ticket_id:
        await _reply(update, context, 'У этой заявки нет привязки к U-ON.')
        return

    from integrations.tasks import pull_uon_reminders_for_lead

    pull_uon_reminders_for_lead.delay(lead.id)
    await _reply(update, context, 'Синхронизация запущена — проверьте /tasks через несколько секунд.')


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    data = query.data

    account = await _get_account(update.effective_chat.id)
    if account is None:
        await query.answer(NOT_LINKED_TEXT, show_alert=True)
        return

    if data == 'menu:tasks':
        await query.answer()
        await _send_task_summary(update, context, account, edit=True)
        return

    if data == 'menu:help':
        await query.answer()
        await _reply(update, context, HELP_TEXT)
        return

    if data.startswith('cat:'):
        _, category, page_str = data.split(':', 2)
        await query.answer()
        await _send_category_page(update, context, account, category, int(page_str), edit=True)
        return

    if data == 'menu:leads':
        await query.answer()
        await _send_lead_summary(update, context, account, edit=True)
        return

    if data.startswith('leadcat:'):
        _, category, page_str = data.split(':', 2)
        await query.answer()
        await _send_lead_category_page(update, context, account, category, int(page_str), edit=True)
        return

    if data.startswith('leadopen:'):
        _, lead_id_str, category, page_str = data.split(':', 3)
        lead = await _get_lead(account.user, int(lead_id_str))
        if lead is None:
            await query.answer('Заявка не найдена.', show_alert=True)
            return
        await query.answer()
        keyboard_rows = list(lead_keyboard(lead).inline_keyboard)
        keyboard_rows.append([InlineKeyboardButton('🔙 К списку', callback_data=f'leadcat:{category}:{page_str}')])
        await update.callback_query.edit_message_text(
            format_lead_summary(lead), reply_markup=InlineKeyboardMarkup(keyboard_rows), parse_mode=ParseMode.HTML,
        )
        return

    if data.startswith('donelist:'):
        _, task_id_str, category, page_str = data.split(':', 3)
        task = await _mark_done(account.user, int(task_id_str))
        if task is None:
            await query.answer('Задача не найдена.', show_alert=True)
            return
        await query.answer('Готово ✅')
        await _send_category_page(update, context, account, category, int(page_str), edit=True)
        return

    if data.startswith('done:'):
        task_id = int(data.split(':', 1)[1])
        task = await _mark_done(account.user, task_id)
        if task is None:
            await query.answer('Задача не найдена.', show_alert=True)
            return
        await query.answer('Готово ✅')
        await query.edit_message_text(f'✅ {escape_html(task.title)} — выполнено', parse_mode=ParseMode.HTML)
        return

    if data.startswith('sync:'):
        lead_id = int(data.split(':', 1)[1])
        lead = await _get_lead_with_uon(account.user, lead_id)
        if lead is None or not lead.uon_ticket_id:
            await query.answer('Нет доступа или нет привязки к U-ON.', show_alert=True)
            return
        from integrations.tasks import pull_uon_reminders_for_lead

        pull_uon_reminders_for_lead.delay(lead.id)
        await query.answer('Синхронизация запущена')
        return

    await query.answer()


async def _post_init(application: Application) -> None:
    await application.bot.set_my_commands([
        BotCommand('tasks', 'Мои открытые задачи'),
        BotCommand('leads', 'Мои заявки'),
        BotCommand('newtask', 'Создать задачу'),
        BotCommand('done', 'Отметить задачу выполненной'),
        BotCommand('lead', 'Карточка заявки'),
        BotCommand('sync_uon', 'Подтянуть напоминания из U-ON'),
        BotCommand('menu', 'Главное меню'),
    ])


def build_application() -> Application:
    application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).post_init(_post_init).build()
    application.add_handler(CommandHandler('start', cmd_start))
    application.add_handler(CommandHandler('menu', cmd_menu))
    application.add_handler(CommandHandler('tasks', cmd_tasks))
    application.add_handler(CommandHandler('leads', cmd_leads))
    application.add_handler(CommandHandler('newtask', cmd_newtask))
    application.add_handler(CommandHandler('done', cmd_done))
    application.add_handler(CommandHandler('lead', cmd_lead))
    application.add_handler(CommandHandler('sync_uon', cmd_sync_uon))
    application.add_handler(CallbackQueryHandler(on_callback))
    return application
