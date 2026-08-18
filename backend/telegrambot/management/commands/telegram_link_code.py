from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from telegrambot.models import TelegramAccount, generate_link_code

User = get_user_model()


class Command(BaseCommand):
    help = (
        'Печатает код привязки Telegram-аккаунта менеджера (создаёт запись, если её ещё нет). '
        'Без аргументов — статус привязки всех менеджеров/руководителей.'
    )

    def add_arguments(self, parser):
        parser.add_argument('username', nargs='?', help='Логин пользователя CRM (не указывать — список всех).')
        parser.add_argument(
            '--regenerate', action='store_true',
            help='Перевыпустить код (например, если старый засветился где-то в переписке).',
        )

    def handle(self, *args, **options):
        username = options['username']
        bot_username = getattr(settings, 'TELEGRAM_BOT_USERNAME', '') or 'flypenza_bot'

        if not username:
            for user in User.objects.order_by('username'):
                account = TelegramAccount.objects.filter(user=user).first()
                status = 'привязан' if (account and account.chat_id) else 'не привязан'
                self.stdout.write(f'{user.username} ({user.get_full_name() or "—"}): {status}')
            return

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist as exc:
            raise CommandError(f'Пользователь «{username}» не найден') from exc

        account, created = TelegramAccount.objects.get_or_create(user=user)
        if options['regenerate'] and not created:
            account.link_code = generate_link_code()
            account.chat_id = None
            account.linked_at = None
            account.save(update_fields=['link_code', 'chat_id', 'linked_at'])

        self.stdout.write(self.style.SUCCESS(f'Код для {username}: {account.link_code}'))
        self.stdout.write(f'Ссылка: https://t.me/{bot_username}?start={account.link_code}')
        self.stdout.write('Отправить пользователю: /start ' + account.link_code + f' боту @{bot_username}')
