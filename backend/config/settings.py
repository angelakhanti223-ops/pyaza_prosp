"""
Django settings for the Sletat.ru site + mini-CRM.
"""

import socket
from pathlib import Path

import environ
from celery.schedules import crontab

# This Docker host's IPv6 routing is broken for outbound connections (confirmed
# live, 18-19.08.2026): any A+AAAA host — api.telegram.org first, then rediscovered
# for celery_worker's own requests.post() calls to the same host — fails with
# "[Errno 101] Network is unreachable" because httpx/urllib3 try the AAAA record
# first. Disabling IPv6 via Docker sysctls didn't fully take (see
# docker-compose.prod.yml history), so we force AF_INET at the Python level
# instead. Belongs here, not in one management command, because every process
# that imports Django settings — backend, celery_worker, celery_beat,
# telegram_bot — can end up making an outbound HTTP call to a dual-stack host.
_original_getaddrinfo = socket.getaddrinfo


def _ipv4_only_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    return _original_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)


socket.getaddrinfo = _ipv4_only_getaddrinfo

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)
environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('DJANGO_SECRET_KEY', default='django-insecure-change-me-in-env')

DEBUG = env('DEBUG')

ALLOWED_HOSTS = env.list('DJANGO_ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])

CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=['http://localhost:3000'])


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'corsheaders',
    'django_ckeditor_5',

    'accounts',
    'leads',
    'articles',
    'kanban',
    'integrations',
    'emailing',
    'sitecontent',
    'telegrambot',
]

AUTH_USER_MODEL = 'accounts.User'

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# Persisted on a Postgres instance that must stay hosted in the RF (152-FZ) in production.

DATABASES = {
    'default': env.db('DATABASE_URL', default='postgres://sletat:sletat@db:5432/sletat'),
}


# Password validation

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# Internationalization

LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'Europe/Moscow'
USE_I18N = True
USE_TZ = True


# Static & media files

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# WhiteNoise serves STATIC_ROOT efficiently straight from the Gunicorn process
# in production (runserver ignores this and serves static files itself, as
# usual, in dev).
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# WYSIWYG editor for article content (ТЗ 4.1) — images uploaded through it land in MEDIA_ROOT.
CKEDITOR_5_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
CKEDITOR_5_CONFIGS = {
    'default': {
        'toolbar': [
            'heading', '|',
            'bold', 'italic', 'underline', '|',
            'bulletedList', 'numberedList', 'blockQuote', '|',
            'link', 'imageUpload', 'insertTable', '|',
            'undo', 'redo',
        ],
        'heading': {
            'options': [
                {'model': 'paragraph', 'title': 'Обычный текст', 'class': 'ck-heading_paragraph'},
                {'model': 'heading2', 'view': 'h2', 'title': 'Заголовок 2', 'class': 'ck-heading_heading2'},
                {'model': 'heading3', 'view': 'h3', 'title': 'Заголовок 3', 'class': 'ck-heading_heading3'},
            ],
        },
    },
}


# CORS — the Next.js frontend calls this API from a different origin in dev.
# Credentials are required for session-cookie auth used by the CRM.

CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=['http://localhost:3000'])
CORS_ALLOW_CREDENTIALS = True


# Django REST Framework

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_RATES': {
        'lead_create': '10/hour',
        'subscribe': '10/hour',
    },
}


# Celery — used for the U-ON retry queue and email sending/scheduling

CELERY_BROKER_URL = env('REDIS_URL', default='redis://redis:6379/0')
CELERY_RESULT_BACKEND = env('REDIS_URL', default='redis://redis:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

# Периодические задачи (Celery Beat). CELERY_TIMEZONE = TIME_ZONE (Europe/Moscow,
# см. выше) — время в crontab() ниже уже московское, дополнительно пересчитывать не нужно.
CELERY_BEAT_SCHEDULE = {
    'sync-uon-reminders': {
        'task': 'integrations.tasks.sync_all_uon_reminders',
        'schedule': 600.0,  # каждые 10 минут
    },
    'advance-uon-followup-chains': {
        'task': 'integrations.tasks.advance_followup_chains',
        'schedule': 300.0,  # каждые 5 минут, см. uonfollowupspec.md §3.3
    },
    'check-stale-leads': {
        'task': 'leads.tasks.check_stale_leads',
        'schedule': crontab(hour=9, minute=0),
    },
    'check-document-issuance-deadlines': {
        'task': 'integrations.tasks.check_document_issuance_deadlines',
        'schedule': crontab(hour=9, minute=0),
    },
    'notify-daily-deadlines': {
        # Написана ещё в прошлой сессии, но расписание для неё так и не завели —
        # старый долг, закрываю заодно (см. leads.tasks.check_stale_leads рядом).
        'task': 'telegrambot.tasks.notify_daily_deadlines',
        'schedule': crontab(hour=9, minute=0),
    },
}


# Email (ТЗ 9). In mock mode (default until an SMTP account exists — see
# emailing/emails.py) messages are printed to the console instead of sent
# over the network. EMAIL_MOCK_MODE is the single switch: it picks the
# Django email backend itself, so there's no separate setting that could
# be left out of sync with it.
EMAIL_MOCK_MODE = env.bool('EMAIL_MOCK_MODE', default=True)
EMAIL_BACKEND = (
    'django.core.mail.backends.console.EmailBackend'
    if EMAIL_MOCK_MODE
    else 'django.core.mail.backends.smtp.EmailBackend'
)
EMAIL_HOST = env('EMAIL_HOST', default='')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='noreply@sletat.ru')
SALES_NOTIFICATION_EMAIL = env('SALES_NOTIFICATION_EMAIL', default='sales@sletat.ru')

# ТЗ 3.2 / 16: whether to auto-email the client a confirmation on lead creation
# is an open question for the client — off by default, ready to flip on.
SEND_LEAD_CONFIRMATION_EMAIL = env.bool('SEND_LEAD_CONFIRMATION_EMAIL', default=False)

SITE_URL = env('NEXT_PUBLIC_SITE_URL', default='http://localhost:3000')
BACKEND_URL = env('BACKEND_URL', default='http://localhost:8000')


# U-ON CRM integration — see integrations/adapters.py. Mock mode is used until
# a real API key is issued by the client.
UON_MOCK_MODE = env.bool('UON_MOCK_MODE', default=True)
UON_API_BASE_URL = env('UON_API_BASE_URL', default='https://api.u-on.ru')
UON_API_KEY = env('UON_API_KEY', default='')
# Optional shared secret checked against ?token= on the webhook receiver (integrations.views.UonWebhookView).
# U-ON's webhook config hasn't confirmed whether it supports a custom token in the URL —
# leave empty to accept all requests until that's verified.
UON_WEBHOOK_SECRET = env('UON_WEBHOOK_SECRET', default='')
# Client's own U-ON account cabinet (not the API host) — used to build "Открыть в U-ON"
# links straight to the record's edit page, confirmed by the client:
# {UON_CABINET_URL}/request_edit_lead.php?r_id={id} — same page for both заявки and
# обращения (only r_id changes); adjust here if обращения turn out to need a different page.
UON_CABINET_URL = env('UON_CABINET_URL', default='https://id62499.u-on.ru')
# Числовой ID менеджера в U-ON (см. GET /manager.json), используется как manager_id/
# created_u_id/done_u_id для reminder/create и reminder/close, когда у обращения нет
# своего менеджера — эти поля документация называет необязательными, но на практике
# их отсутствие роняет U-ON в 500 (подтверждено 18.08.2026 трижды на живом API, в том
# числе на заведомо валидной заявке). Пусто — цепочка автозадач пропустит создание
# напоминания в U-ON для обращений без менеджера (в лог), но задача на канбане и
# уведомление в Telegram всё равно создадутся.
UON_DEFAULT_MANAGER_ID = env('UON_DEFAULT_MANAGER_ID', default='')


# Telegram bot (менеджерские команды и уведомления о назначении задач/заявок —
# см. telegrambot/). Отключён по умолчанию — бот безопасно отсутствует, пока
# не создан токен через @BotFather (см. TELEGRAM_BOT_TOKEN в .env).
TELEGRAM_BOT_ENABLED = env.bool('TELEGRAM_BOT_ENABLED', default=False)
TELEGRAM_BOT_TOKEN = env('TELEGRAM_BOT_TOKEN', default='')
TELEGRAM_API_BASE_URL = env('TELEGRAM_API_BASE_URL', default='https://api.telegram.org')
# Юзернейм бота у @BotFather (без @) — только для человекочитаемых ссылок
# привязки (telegram_link_code), сам бот определяет себя по токену.
TELEGRAM_BOT_USERNAME = env('TELEGRAM_BOT_USERNAME', default='flypenza_bot')

# Если задан TELEGRAM_WEBHOOK_URL — бот работает через вебхук (Telegram сам шлёт
# короткий POST на этот адрес), иначе — long polling (см. run_telegram_bot.py).
# Причина: с прод-сервера (РФ) long polling стабильно валится в TimedOut —
# подтверждено 18.08.2026, оператор режет именно постоянно открытые исходящие
# соединения, короткие запросы к api.telegram.org при этом проходят нормально.
# В деве оставляем пусто — там нет публичного HTTPS для приёма вебхука.
TELEGRAM_WEBHOOK_URL = env('TELEGRAM_WEBHOOK_URL', default='')
TELEGRAM_WEBHOOK_PATH = env('TELEGRAM_WEBHOOK_PATH', default='/telegram-webhook')
TELEGRAM_WEBHOOK_PORT = env.int('TELEGRAM_WEBHOOK_PORT', default=8080)
# Telegram присылает это значение в заголовке X-Telegram-Bot-Api-Secret-Token
# на каждом вебхуке — минимальная защита от посторонних POST на этот URL,
# аналогично UON_WEBHOOK_SECRET для интеграции с U-ON.
TELEGRAM_WEBHOOK_SECRET = env('TELEGRAM_WEBHOOK_SECRET', default='')


LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}
