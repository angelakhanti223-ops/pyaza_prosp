"""Обработчики команд и inline-кнопок бота (python-telegram-bot, long polling —
см. management/commands/run_telegram_bot.py).

Все обращения к Django ORM обёрнуты в sync_to_async, так как ORM Django
синхронный, а PTB v21+ работает на asyncio.
"""
import logging

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

MAX_TASKS_SHOWN = 20

NOT_LINKED_TEXT = 'Аккаунт не привязан. Обратитесь к руководителю за кодом (/start &lt;код&gt;).'

HELP_TEXT = (
    '<b>Доступные команды</b>\n'
    '/tasks — мои открытые задачи\n'
    '/newtask &lt;текст&gt; — создать задачу\n'
    '/done &lt;номер&gt; — отметить задачу выполненной\n'
    '/lead &lt;номер&gt; — карточка заявки\n'
    '/sync_uon &lt;номер&gt; — подтянуть напоминания из U-ON\n'
    '/menu — главное меню'
)

MAIN_MENU_KEYBOARD = InlineKeyboardMarkup([
    [InlineKeyboardButton('📋 Мои задачи', callback_data='menu:tasks')],
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


@sync_to_async
def _list_open_tasks(user):
    from kanban.models import Task

    last_column = get_last_column()
    qs = Task.objects.select_related('column', 'lead').filter(assignee=user)
    if last_column:
        qs = qs.exclude(column=last_column)
    return list(qs.order_by('column__order', 'order')[:MAX_TASKS_SHOWN])


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


async def _send_tasks(update: Update, context: ContextTypes.DEFAULT_TYPE, account: TelegramAccount):
    tasks = await _list_open_tasks(account.user)
    if not tasks:
        await _reply(update, context, '🎉 Открытых задач нет.')
        return
    for task in tasks:
        await _reply(update, context, format_task_line(task), keyboard=task_keyboard(task))


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
    await _send_tasks(update, context, account)


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
        await _send_tasks(update, context, account)
        return

    if data == 'menu:help':
        await query.answer()
        await _reply(update, context, HELP_TEXT)
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
    application.add_handler(CommandHandler('newtask', cmd_newtask))
    application.add_handler(CommandHandler('done', cmd_done))
    application.add_handler(CommandHandler('lead', cmd_lead))
    application.add_handler(CommandHandler('sync_uon', cmd_sync_uon))
    application.add_handler(CallbackQueryHandler(on_callback))
    return application
