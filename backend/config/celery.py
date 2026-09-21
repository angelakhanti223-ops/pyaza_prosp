import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('sletat')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Дополнительная периодическая задача вне settings.py, чтобы не трогать большой
# общий CELERY_BEAT_SCHEDULE: ежедневно в 09:00 МСК забираем курсы валют
# туроператоров из кабинета U-ON и сохраняем их по каждому ТО/валюте/дате.
beat_schedule = dict(app.conf.beat_schedule or {})
beat_schedule['sync-uon-operator-exchange-rates'] = {
    'task': 'leads.tasks.sync_uon_operator_exchange_rates',
    'schedule': crontab(hour=9, minute=0),
}
app.conf.beat_schedule = beat_schedule
