from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from kanban.models import KanbanColumn, Task
from leads.models import Direction, Lead, MonthlyPlan

from .bot import cmd_done, cmd_lead, cmd_leads, cmd_newtask, cmd_plan, cmd_start, cmd_sync_uon, cmd_tasks, on_callback
from .models import TelegramAccount, TelegramNotificationLog
from .services import build_board_url, build_lead_url, build_uon_record_url, format_lead_summary, format_task_line
from .tasks import (
    notify_lead_assignment,
    notify_lead_client_replied,
    notify_lead_status_change,
    notify_task_assignment,
    notify_weekly_plan_progress,
)

User = get_user_model()


def make_update(chat_id, username='testuser'):
    update = MagicMock()
    update.effective_chat.id = chat_id
    update.effective_user.username = username
    return update


def make_context(args=None):
    context = MagicMock()
    context.args = args or []
    context.bot.send_message = AsyncMock()
    return context


def make_callback(chat_id, data):
    """Returns (update, query) for a button-press update with callback_data=data."""
    update = MagicMock()
    update.effective_chat.id = chat_id
    query = MagicMock()
    query.data = data
    query.answer = AsyncMock()
    query.edit_message_text = AsyncMock()
    update.callback_query = query
    return update, query


def sent_texts(context):
    return [call.kwargs['text'] for call in context.bot.send_message.call_args_list]


class TelegramAccountModelTests(TestCase):
    def test_link_code_auto_generated_and_unique(self):
        user1 = User.objects.create_user(username='m1', password='x')
        user2 = User.objects.create_user(username='m2', password='x')
        acc1 = TelegramAccount.objects.create(user=user1)
        acc2 = TelegramAccount.objects.create(user=user2)

        self.assertTrue(acc1.link_code)
        self.assertNotEqual(acc1.link_code, acc2.link_code)
        self.assertIsNone(acc1.chat_id)

    def test_chat_id_unique(self):
        user1 = User.objects.create_user(username='m1', password='x')
        user2 = User.objects.create_user(username='m2', password='x')
        TelegramAccount.objects.create(user=user1, chat_id=100)
        with self.assertRaises(Exception):
            TelegramAccount.objects.create(user=user2, chat_id=100)


class ServicesFormattingTests(TestCase):
    def setUp(self):
        self.direction = Direction.objects.create(name='Турция')
        self.lead = Lead.objects.create(
            name='Иван Иванов', phone='+79991234567', email='ivan@example.com',
            direction=self.direction, deal_amount=Decimal('50000'),
        )
        self.column = KanbanColumn.objects.get(name='Новая')
        self.task = Task.objects.create(title='Позвонить клиенту', column=self.column, lead=self.lead)

    def test_lead_url(self):
        self.assertTrue(build_lead_url(self.lead.id).endswith(f'/crm/leads/{self.lead.id}'))

    def test_board_url(self):
        self.assertTrue(build_board_url().endswith('/crm/kanban'))

    @override_settings(UON_CABINET_URL='https://id62499.u-on.ru')
    def test_uon_record_url_request(self):
        url = build_uon_record_url('request', '61')
        self.assertEqual(url, 'https://id62499.u-on.ru/request_edit_lead.php?r_id=61')

    @override_settings(UON_CABINET_URL='https://id62499.u-on.ru')
    def test_uon_record_url_lead_same_page(self):
        # Подтверждено клиентом: тот же адрес для обращений, меняется только r_id.
        url = build_uon_record_url('lead', '199')
        self.assertEqual(url, 'https://id62499.u-on.ru/request_edit_lead.php?r_id=199')

    def test_format_lead_summary_has_no_pii(self):
        text = format_lead_summary(self.lead)
        self.assertNotIn(self.lead.name, text)
        self.assertNotIn(self.lead.phone, text)
        self.assertNotIn(self.lead.email, text)
        self.assertIn(str(self.lead.id), text)
        self.assertIn(self.direction.name, text)

    def test_format_task_line_has_no_pii(self):
        # The CRM link is now delivered as a button (see bot.task_keyboard),
        # not embedded in the message text, so it's no longer asserted here.
        text = format_task_line(self.task)
        self.assertNotIn(self.lead.name, text)
        self.assertNotIn(self.lead.phone, text)
        self.assertIn(self.task.title, text)


class BotHandlersTests(TestCase):
    def setUp(self):
        # 'Новая'/'Готово' already exist from kanban's 0002_seed_default_columns
        # data migration — reuse them instead of creating competing columns
        # with the same order values.
        self.head = User.objects.create_user(username='head', password='x', role=User.Role.HEAD)
        self.manager = User.objects.create_user(username='manager', password='x', role=User.Role.MANAGER)
        self.other_manager = User.objects.create_user(username='other', password='x', role=User.Role.MANAGER)
        self.column_new = KanbanColumn.objects.get(name='Новая')
        self.column_done = KanbanColumn.objects.get(name='Готово')
        self.account = TelegramAccount.objects.create(user=self.manager, chat_id=555)

    def test_start_links_account_with_valid_code(self):
        pending = TelegramAccount.objects.create(user=self.other_manager)
        update = make_update(chat_id=999)
        context = make_context(args=[pending.link_code])

        async_to_sync(cmd_start)(update, context)

        pending.refresh_from_db()
        self.assertEqual(pending.chat_id, 999)
        self.assertIsNotNone(pending.linked_at)
        context.bot.send_message.assert_called_once()

    def test_start_rejects_unknown_code(self):
        update = make_update(chat_id=999)
        context = make_context(args=['bogus'])

        async_to_sync(cmd_start)(update, context)

        self.assertIn('не найден', sent_texts(context)[0])

    def test_tasks_shows_summary_counting_only_own_open_tasks(self):
        # /tasks теперь шлёт сводку по срокам (см. bot._format_summary_text), а не
        # по сообщению на каждую задачу — названия задач в сводке не появляются,
        # только счётчики; сами названия проверяются в CallbackHandlerTests
        # через разворачивание конкретной категории (cat:<категория>:<страница>).
        Task.objects.create(title='Моя задача', column=self.column_new, assignee=self.manager)
        Task.objects.create(title='Чужая задача', column=self.column_new, assignee=self.other_manager)
        Task.objects.create(title='Готовая задача', column=self.column_done, assignee=self.manager)

        update = make_update(chat_id=555)
        context = make_context()
        async_to_sync(cmd_tasks)(update, context)

        text = sent_texts(context)[0]
        self.assertIn('1 открытых', text)
        self.assertNotIn('Чужая задача', text)
        self.assertNotIn('Готовая задача', text)

    def test_tasks_empty_shows_friendly_message(self):
        update = make_update(chat_id=555)
        context = make_context()
        async_to_sync(cmd_tasks)(update, context)

        self.assertIn('нет', sent_texts(context)[0])

    def test_newtask_creates_task_assigned_to_self(self):
        update = make_update(chat_id=555)
        context = make_context(args=['Написать', 'клиенту'])
        async_to_sync(cmd_newtask)(update, context)

        task = Task.objects.get(title='Написать клиенту')
        self.assertEqual(task.assignee_id, self.manager.id)
        self.assertEqual(task.column_id, self.column_new.id)

    def test_done_moves_own_task_to_last_column(self):
        task = Task.objects.create(title='Задача', column=self.column_new, assignee=self.manager)
        update = make_update(chat_id=555)
        async_to_sync(cmd_done)(update, make_context(args=[str(task.id)]))

        task.refresh_from_db()
        self.assertEqual(task.column_id, self.column_done.id)

    def test_done_rejects_other_managers_task(self):
        task = Task.objects.create(title='Чужая', column=self.column_new, assignee=self.other_manager)
        update = make_update(chat_id=555)
        context = make_context(args=[str(task.id)])
        async_to_sync(cmd_done)(update, context)

        task.refresh_from_db()
        self.assertEqual(task.column_id, self.column_new.id)
        self.assertIn('не найдена', sent_texts(context)[0])

    def test_lead_shows_summary_without_pii_for_owner(self):
        direction = Direction.objects.create(name='Египет')
        lead = Lead.objects.create(
            name='Пётр Петров', phone='+7000', direction=direction, assigned_manager=self.manager,
        )
        update = make_update(chat_id=555)
        context = make_context(args=[str(lead.id)])
        async_to_sync(cmd_lead)(update, context)

        text = sent_texts(context)[0]
        self.assertNotIn('Пётр Петров', text)
        self.assertNotIn('+7000', text)
        self.assertIn('Египет', text)

    def test_lead_denies_non_owner_manager(self):
        direction = Direction.objects.create(name='Турция2')
        lead = Lead.objects.create(name='Чужой клиент', direction=direction, assigned_manager=self.other_manager)
        update = make_update(chat_id=555)
        context = make_context(args=[str(lead.id)])
        async_to_sync(cmd_lead)(update, context)

        self.assertIn('не найдена', sent_texts(context)[0])

    def test_head_can_see_any_lead(self):
        TelegramAccount.objects.create(user=self.head, chat_id=777)
        direction = Direction.objects.create(name='Таиланд')
        lead = Lead.objects.create(name='Клиент', direction=direction, assigned_manager=self.other_manager)
        update = make_update(chat_id=777)
        context = make_context(args=[str(lead.id)])
        async_to_sync(cmd_lead)(update, context)

        self.assertIn('Таиланд', sent_texts(context)[0])

    @patch('integrations.tasks.pull_uon_reminders_for_lead.delay')
    def test_sync_uon_triggers_pull_for_own_lead(self, mock_delay):
        direction = Direction.objects.create(name='Куба')
        lead = Lead.objects.create(
            name='Клиент', direction=direction, assigned_manager=self.manager, uon_ticket_id='61',
        )
        update = make_update(chat_id=555)
        async_to_sync(cmd_sync_uon)(update, make_context(args=[str(lead.id)]))

        mock_delay.assert_called_once_with(lead.id)

    @patch('integrations.tasks.pull_uon_reminders_for_lead.delay')
    def test_sync_uon_denies_non_owner_manager(self, mock_delay):
        direction = Direction.objects.create(name='Вьетнам')
        lead = Lead.objects.create(
            name='Чужой клиент', direction=direction, assigned_manager=self.other_manager, uon_ticket_id='61',
        )
        update = make_update(chat_id=555)
        context = make_context(args=[str(lead.id)])
        async_to_sync(cmd_sync_uon)(update, context)

        mock_delay.assert_not_called()
        self.assertIn('не найдена', sent_texts(context)[0])

    def test_sync_uon_rejects_lead_without_uon_ticket(self):
        direction = Direction.objects.create(name='Кипр')
        lead = Lead.objects.create(name='Клиент', direction=direction, assigned_manager=self.manager)
        update = make_update(chat_id=555)
        context = make_context(args=[str(lead.id)])
        async_to_sync(cmd_sync_uon)(update, context)

        self.assertIn('нет привязки', sent_texts(context)[0])


class CallbackHandlerTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager', password='x', role=User.Role.MANAGER)
        self.other_manager = User.objects.create_user(username='other', password='x', role=User.Role.MANAGER)
        self.column_new = KanbanColumn.objects.get(name='Новая')
        self.column_done = KanbanColumn.objects.get(name='Готово')
        self.account = TelegramAccount.objects.create(user=self.manager, chat_id=555)

    def test_unlinked_chat_gets_alert(self):
        update, query = make_callback(chat_id=42, data='menu:tasks')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        query.answer.assert_called_once()
        self.assertTrue(query.answer.call_args.kwargs.get('show_alert'))

    def test_menu_tasks_shows_summary_via_edit(self):
        Task.objects.create(title='Моя задача', column=self.column_new, assignee=self.manager)
        update, query = make_callback(chat_id=555, data='menu:tasks')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        query.answer.assert_called_once()
        query.edit_message_text.assert_called_once()
        self.assertIn('1 открытых', query.edit_message_text.call_args.args[0])

    def test_category_callback_shows_task_titles(self):
        Task.objects.create(title='Моя задача без срока', column=self.column_new, assignee=self.manager)
        update, query = make_callback(chat_id=555, data='cat:no_deadline:1')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        query.edit_message_text.assert_called_once()
        self.assertIn('Моя задача без срока', query.edit_message_text.call_args.args[0])

    def test_category_callback_paginates(self):
        for i in range(7):
            Task.objects.create(title=f'Задача {i}', column=self.column_new, assignee=self.manager)
        update, query = make_callback(chat_id=555, data='cat:no_deadline:1')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        text = query.edit_message_text.call_args.args[0]
        self.assertIn('Страница 1 из 2', text)
        # Пять на странице (см. bot.TASKS_PAGE_SIZE), шестая и седьмая — на второй.
        self.assertEqual(text.count('. Задача '), 5)

    def test_donelist_callback_marks_task_and_refreshes_category(self):
        task = Task.objects.create(title='Задача без срока', column=self.column_new, assignee=self.manager)
        update, query = make_callback(chat_id=555, data=f'donelist:{task.id}:no_deadline:1')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        task.refresh_from_db()
        self.assertEqual(task.column_id, self.column_done.id)
        query.answer.assert_called_once_with('Готово ✅')
        self.assertIn('Здесь пусто', query.edit_message_text.call_args.args[0])

    def test_menu_help_sends_help_text(self):
        update, query = make_callback(chat_id=555, data='menu:help')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        self.assertIn('команды', sent_texts(context)[0].lower())

    def test_done_callback_marks_task_and_edits_message(self):
        task = Task.objects.create(title='Задача', column=self.column_new, assignee=self.manager)
        update, query = make_callback(chat_id=555, data=f'done:{task.id}')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        task.refresh_from_db()
        self.assertEqual(task.column_id, self.column_done.id)
        query.edit_message_text.assert_called_once()
        self.assertIn('выполнено', query.edit_message_text.call_args.args[0])

    def test_done_callback_rejects_other_managers_task(self):
        task = Task.objects.create(title='Чужая', column=self.column_new, assignee=self.other_manager)
        update, query = make_callback(chat_id=555, data=f'done:{task.id}')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        task.refresh_from_db()
        self.assertEqual(task.column_id, self.column_new.id)
        query.edit_message_text.assert_not_called()
        self.assertTrue(query.answer.call_args.kwargs.get('show_alert'))

    @patch('integrations.tasks.pull_uon_reminders_for_lead.delay')
    def test_sync_callback_triggers_pull(self, mock_delay):
        direction = Direction.objects.create(name='Марокко')
        lead = Lead.objects.create(
            name='Клиент', direction=direction, assigned_manager=self.manager, uon_ticket_id='61',
        )
        update, query = make_callback(chat_id=555, data=f'sync:{lead.id}')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        mock_delay.assert_called_once_with(lead.id)
        query.answer.assert_called_once()


class LeadSummaryBotTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='leadmanager', password='x', role=User.Role.MANAGER)
        self.other_manager = User.objects.create_user(username='otherlead', password='x', role=User.Role.MANAGER)
        self.account = TelegramAccount.objects.create(user=self.manager, chat_id=555)
        self.direction = Direction.objects.create(name='Греция')

    def test_leads_command_shows_summary_counting_only_own_open_leads(self):
        Lead.objects.create(name='Мой лид', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.NEW)
        Lead.objects.create(name='Чужой', direction=self.direction, assigned_manager=self.other_manager)
        Lead.objects.create(
            name='Закрыт', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.CLOSED_WON,
        )

        update = make_update(chat_id=555)
        context = make_context()
        async_to_sync(cmd_leads)(update, context)

        text = sent_texts(context)[0]
        self.assertIn('1 открытых', text)
        self.assertNotIn('Мой лид', text)  # ФИО не должно быть в сводке — ТЗ 11.5, 152-ФЗ

    def test_menu_leads_callback_shows_summary_via_edit(self):
        Lead.objects.create(name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.NEW)
        update, query = make_callback(chat_id=555, data='menu:leads')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        query.edit_message_text.assert_called_once()
        self.assertIn('1 открытых', query.edit_message_text.call_args.args[0])

    def test_leadcat_callback_lists_leads_without_pii(self):
        lead = Lead.objects.create(
            name='Секретное Имя', phone='+79990000000', direction=self.direction,
            assigned_manager=self.manager, status=Lead.Status.NEW,
        )
        update, query = make_callback(chat_id=555, data='leadcat:new:1')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        text = query.edit_message_text.call_args.args[0]
        self.assertIn(f'№{lead.id}', text)
        self.assertNotIn('Секретное Имя', text)
        self.assertNotIn('+79990000000', text)

    def test_leadopen_callback_shows_full_card_with_back_button(self):
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.NEW,
        )
        update, query = make_callback(chat_id=555, data=f'leadopen:{lead.id}:new:1')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        query.edit_message_text.assert_called_once()
        text = query.edit_message_text.call_args.args[0]
        self.assertIn(f'#{lead.id}', text)
        keyboard = query.edit_message_text.call_args.kwargs['reply_markup']
        back_buttons = [
            btn.callback_data for row in keyboard.inline_keyboard for btn in row
            if btn.callback_data == 'leadcat:new:1'
        ]
        self.assertEqual(len(back_buttons), 1)

    def test_leadopen_callback_denies_other_managers_lead(self):
        lead = Lead.objects.create(name='Чужой', direction=self.direction, assigned_manager=self.other_manager)
        update, query = make_callback(chat_id=555, data=f'leadopen:{lead.id}:new:1')
        context = make_context()
        async_to_sync(on_callback)(update, context)

        query.answer.assert_called_once()
        self.assertTrue(query.answer.call_args.kwargs.get('show_alert'))


class NotifyTaskTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager', password='x')
        self.column = KanbanColumn.objects.get(name='Новая')
        self.account = TelegramAccount.objects.create(user=self.manager, chat_id=555)

    @override_settings(TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token', SITE_URL='https://sletat.ru')
    @patch('telegrambot.tasks.requests.post')
    def test_notify_task_assignment_sends_message_with_button(self, mock_post):
        mock_post.return_value.raise_for_status = MagicMock()

        task = Task.objects.create(title='Задача', column=self.column, assignee=self.manager)
        notify_task_assignment(task.id)

        mock_post.assert_called_once()
        self.assertEqual(mock_post.call_args.kwargs['json']['chat_id'], 555)
        self.assertIn('reply_markup', mock_post.call_args.kwargs['json'])
        log = TelegramNotificationLog.objects.get()
        self.assertEqual(log.status, TelegramNotificationLog.Status.SUCCESS)

    @override_settings(
        TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token',
        UON_CABINET_URL='https://id62499.u-on.ru',
    )
    @patch('telegrambot.tasks.requests.post')
    def test_notify_task_assignment_links_to_uon_record_when_set(self, mock_post):
        mock_post.return_value.raise_for_status = MagicMock()

        task = Task.objects.create(
            title='Задача', column=self.column, assignee=self.manager,
            uon_record_kind='request', uon_record_id='61',
        )
        notify_task_assignment(task.id)

        url = mock_post.call_args.kwargs['json']['reply_markup']['inline_keyboard'][0][0]['url']
        self.assertEqual(url, 'https://id62499.u-on.ru/request_edit_lead.php?r_id=61')

    @override_settings(TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token', SITE_URL='http://localhost:3000')
    @patch('telegrambot.tasks.requests.post')
    def test_notify_task_assignment_omits_button_for_localhost(self, mock_post):
        mock_post.return_value.raise_for_status = MagicMock()

        task = Task.objects.create(title='Задача', column=self.column, assignee=self.manager)
        notify_task_assignment(task.id)

        self.assertNotIn('reply_markup', mock_post.call_args.kwargs['json'])

    @override_settings(TELEGRAM_BOT_ENABLED=False)
    @patch('telegrambot.tasks.requests.post')
    def test_notify_task_assignment_noop_when_disabled(self, mock_post):
        task = Task.objects.create(title='Задача', column=self.column, assignee=self.manager)
        notify_task_assignment(task.id)
        mock_post.assert_not_called()

    @override_settings(TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token')
    @patch('telegrambot.tasks.requests.post')
    def test_notify_task_assignment_skips_without_linked_account(self, mock_post):
        other = User.objects.create_user(username='nolink', password='x')
        task = Task.objects.create(title='Задача', column=self.column, assignee=other)
        notify_task_assignment(task.id)
        mock_post.assert_not_called()


class NotifyLeadTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager2', password='x')
        self.account = TelegramAccount.objects.create(user=self.manager, chat_id=666)
        self.direction = Direction.objects.create(name='ОАЭ')

    @override_settings(TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token')
    @patch('telegrambot.tasks.requests.post')
    def test_notify_lead_assignment_sends_message(self, mock_post):
        mock_post.return_value.raise_for_status = MagicMock()

        lead = Lead.objects.create(name='Клиент', direction=self.direction, assigned_manager=self.manager)
        notify_lead_assignment(lead.id)

        mock_post.assert_called_once()
        log = TelegramNotificationLog.objects.get()
        self.assertEqual(log.status, TelegramNotificationLog.Status.SUCCESS)


class NotifyLeadStatusChangeTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager3', password='x')
        self.account = TelegramAccount.objects.create(user=self.manager, chat_id=777)
        self.direction = Direction.objects.create(name='Кипр')

    @override_settings(TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token')
    @patch('telegrambot.tasks.requests.post')
    def test_sends_message_for_booked(self, mock_post):
        mock_post.return_value.raise_for_status = MagicMock()
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=self.manager, status=Lead.Status.BOOKED,
        )

        notify_lead_status_change(lead.id, Lead.Status.BOOKED)

        mock_post.assert_called_once()
        self.assertIn('Бронь', mock_post.call_args.kwargs['json']['text'])

    @override_settings(TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token')
    @patch('telegrambot.tasks.requests.post')
    def test_skips_without_assignee(self, mock_post):
        lead = Lead.objects.create(name='Клиент', direction=self.direction, status=Lead.Status.PAID)
        notify_lead_status_change(lead.id, Lead.Status.PAID)
        mock_post.assert_not_called()

    @override_settings(TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token')
    @patch('telegrambot.tasks.requests.post')
    def test_skips_without_linked_account(self, mock_post):
        other = User.objects.create_user(username='nolink2', password='x')
        lead = Lead.objects.create(
            name='Клиент', direction=self.direction, assigned_manager=other, status=Lead.Status.CLOSED_LOST,
        )
        notify_lead_status_change(lead.id, Lead.Status.CLOSED_LOST)
        mock_post.assert_not_called()


class NotifyLeadClientRepliedTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager4', password='x')
        self.account = TelegramAccount.objects.create(user=self.manager, chat_id=888)
        self.direction = Direction.objects.create(name='Черногория')

    @override_settings(TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token')
    @patch('telegrambot.tasks.requests.post')
    def test_sends_message(self, mock_post):
        mock_post.return_value.raise_for_status = MagicMock()
        lead = Lead.objects.create(name='Клиент', direction=self.direction, assigned_manager=self.manager)

        notify_lead_client_replied(lead.id)

        mock_post.assert_called_once()
        self.assertIn('ответил', mock_post.call_args.kwargs['json']['text'])

    @override_settings(TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token')
    @patch('telegrambot.tasks.requests.post')
    def test_skips_without_assignee(self, mock_post):
        lead = Lead.objects.create(name='Клиент', direction=self.direction)
        notify_lead_client_replied(lead.id)
        mock_post.assert_not_called()


class PlanBotTests(TestCase):
    def setUp(self):
        from django.utils import timezone

        self.head = User.objects.create_user(username='planhead', password='x', role=User.Role.HEAD)
        self.manager1 = User.objects.create_user(username='planmanager1', password='x', role=User.Role.MANAGER)
        self.manager2 = User.objects.create_user(username='planmanager2', password='x', role=User.Role.MANAGER)
        self.head_account = TelegramAccount.objects.create(user=self.head, chat_id=901)
        self.manager1_account = TelegramAccount.objects.create(user=self.manager1, chat_id=902)
        today = timezone.localdate()
        self.year, self.month = today.year, today.month
        MonthlyPlan.objects.create(manager=self.manager1, year=self.year, month=self.month, target_commission=60000)
        MonthlyPlan.objects.create(manager=self.manager2, year=self.year, month=self.month, target_commission=80000)

    def test_manager_sees_only_own_row(self):
        update = make_update(chat_id=902)
        context = make_context()
        async_to_sync(cmd_plan)(update, context)

        text = sent_texts(context)[0]
        self.assertIn('60 000', text)
        self.assertNotIn('80 000', text)
        self.assertNotIn('Итого офис', text)

    def test_head_sees_all_rows_and_total(self):
        update = make_update(chat_id=901)
        context = make_context()
        async_to_sync(cmd_plan)(update, context)

        text = sent_texts(context)[0]
        self.assertIn('60 000', text)
        self.assertIn('80 000', text)
        self.assertIn('Итого офис', text)
        self.assertIn('140 000', text)

    def test_unlinked_chat_gets_not_linked_message(self):
        update = make_update(chat_id=999)
        context = make_context()
        async_to_sync(cmd_plan)(update, context)
        self.assertIn('не привязан', sent_texts(context)[0])


class NotifyWeeklyPlanProgressTests(TestCase):
    def setUp(self):
        from django.utils import timezone

        self.head = User.objects.create_user(username='weeklyhead', password='x', role=User.Role.HEAD)
        self.manager = User.objects.create_user(username='weeklymanager', password='x', role=User.Role.MANAGER)
        self.head_account = TelegramAccount.objects.create(user=self.head, chat_id=911)
        self.manager_account = TelegramAccount.objects.create(user=self.manager, chat_id=912)
        today = timezone.localdate()
        self.year, self.month = today.year, today.month
        MonthlyPlan.objects.create(manager=self.manager, year=self.year, month=self.month, target_commission=60000)

    @override_settings(TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token')
    @patch('telegrambot.tasks.requests.post')
    def test_sends_personal_and_office_digests(self, mock_post):
        mock_post.return_value.raise_for_status = MagicMock()

        notify_weekly_plan_progress()

        self.assertEqual(mock_post.call_count, 2)
        texts_by_chat = {call.kwargs['json']['chat_id']: call.kwargs['json']['text'] for call in mock_post.call_args_list}
        self.assertIn('60 000', texts_by_chat[911])
        self.assertIn('60 000', texts_by_chat[912])

    @override_settings(TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token')
    @patch('telegrambot.tasks.requests.post')
    def test_skips_manager_without_plan(self, mock_post):
        mock_post.return_value.raise_for_status = MagicMock()
        other = User.objects.create_user(username='noplan', password='x')
        TelegramAccount.objects.create(user=other, chat_id=913)

        notify_weekly_plan_progress()

        chat_ids = {call.kwargs['json']['chat_id'] for call in mock_post.call_args_list}
        self.assertNotIn(913, chat_ids)

    @override_settings(TELEGRAM_BOT_ENABLED=True, TELEGRAM_BOT_TOKEN='test-token')
    @patch('telegrambot.tasks.requests.post')
    def test_skips_entirely_when_no_plan_for_month(self, mock_post):
        MonthlyPlan.objects.all().delete()
        notify_weekly_plan_progress()
        mock_post.assert_not_called()
