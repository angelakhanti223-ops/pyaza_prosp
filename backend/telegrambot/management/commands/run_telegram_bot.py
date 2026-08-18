import logging
import time

from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger('telegrambot')


class Command(BaseCommand):
    help = (
        'Запускает Telegram-бота для команд менеджеров: webhook-режим, если задан '
        'TELEGRAM_WEBHOOK_URL, иначе long polling.'
    )

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

        if settings.TELEGRAM_WEBHOOK_URL:
            # Вебхук: Telegram сам шлёт короткий POST при каждом апдейте — в
            # отличие от long polling (постоянно открытое исходящее соединение),
            # это не упирается в замедление Telegram у российских провайдеров
            # (см. TELEGRAM_WEBHOOK_URL в settings.py).
            self.stdout.write(self.style.SUCCESS(
                f'Telegram-бот запущен (webhook: {settings.TELEGRAM_WEBHOOK_URL})...',
            ))
            application.run_webhook(
                listen='0.0.0.0',
                port=settings.TELEGRAM_WEBHOOK_PORT,
                url_path=settings.TELEGRAM_WEBHOOK_PATH,
                webhook_url=settings.TELEGRAM_WEBHOOK_URL,
                secret_token=settings.TELEGRAM_WEBHOOK_SECRET or None,
                allowed_updates=Update.ALL_TYPES,
            )
        else:
            self.stdout.write(self.style.SUCCESS('Telegram-бот запущен (long polling)...'))
            application.run_polling(allowed_updates=Update.ALL_TYPES)
