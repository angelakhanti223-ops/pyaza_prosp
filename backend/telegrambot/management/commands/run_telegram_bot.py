import logging
import socket
import time

from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger('telegrambot')

# api.telegram.org resolves to both an A and AAAA record. The prod container has
# no usable IPv6 route, and disabling it via Docker sysctls (net.ipv6.conf.all/
# default.disable_ipv6=1) turned out not to fully take effect in this environment
# — httpx still tried the AAAA candidate and failed (errno 101 Network unreachable,
# then errno 99 Cannot assign requested address after the partial sysctl fix;
# confirmed live, 18.08.2026). Forcing getaddrinfo to AF_INET here is the one fix
# that's guaranteed to work regardless of container/kernel IPv6 configuration,
# since it stops any IPv6 address from ever reaching httpx/httpcore in the first
# place — must run before build_application() creates the bot's HTTP client.
_original_getaddrinfo = socket.getaddrinfo


def _ipv4_only_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    return _original_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)


socket.getaddrinfo = _ipv4_only_getaddrinfo


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
