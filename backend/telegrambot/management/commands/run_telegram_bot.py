import logging
import time

from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger('telegrambot')


class Command(BaseCommand):
    help = 'Запускает Telegram-бота (long polling) для команд менеджеров.'

    def handle(self, *args, **options):
        if not settings.TELEGRAM_BOT_ENABLED or not settings.TELEGRAM_BOT_TOKEN:
            # docker-compose runs this under `restart: unless-stopped`, which
            # restarts the container on ANY exit (including 0) — so we block
            # here instead of returning, to avoid a noisy restart loop while
            # no bot token is configured.
            logger.warning('TELEGRAM_BOT_ENABLED=False или TELEGRAM_BOT_TOKEN не задан — бот не запущен.')
            while True:
                time.sleep(3600)

        from telegram import Update

        from telegrambot.bot import build_application

        application = build_application()
        self.stdout.write(self.style.SUCCESS('Telegram-бот запущен (long polling)...'))
        application.run_polling(allowed_updates=Update.ALL_TYPES)
