"""
Django settings for the Sletat.ru site + mini-CRM.
"""

from pathlib import Path

import environ

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

# Периодические задачи (Celery Beat) — сейчас только подтяжка напоминаний из U-ON.
CELERY_BEAT_SCHEDULE = {
    'sync-uon-reminders': {
        'task': 'integrations.tasks.sync_all_uon_reminders',
        'schedule': 600.0,  # каждые 10 минут
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


# Telegram bot (менеджерские команды и уведомления о назначении задач/заявок —
# см. telegrambot/). Отключён по умолчанию — бот безопасно отсутствует, пока
# не создан токен через @BotFather (см. TELEGRAM_BOT_TOKEN в .env).
TELEGRAM_BOT_ENABLED = env.bool('TELEGRAM_BOT_ENABLED', default=False)
TELEGRAM_BOT_TOKEN = env('TELEGRAM_BOT_TOKEN', default='')
TELEGRAM_API_BASE_URL = env('TELEGRAM_API_BASE_URL', default='https://api.telegram.org')


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
