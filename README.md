# Слетать.ру — сайт + мини-CRM

Монорепозиторий: публичный сайт (Next.js) + бэкенд/CRM (Django) + Postgres + Redis/Celery, поднимаются локально через Docker Compose.

## Стек

- **Backend**: Django + Django REST Framework, PostgreSQL, Redis/Celery
- **Frontend**: Next.js (App Router, TypeScript, Tailwind)
- **Локальная разработка**: Docker Compose

## Быстрый старт

1. Скопируйте `.env.example` в `.env` и при необходимости поправьте значения:
   ```
   cp .env.example .env
   ```
2. Поднимите стек:
   ```
   docker compose up --build
   ```
3. Примените миграции (в отдельном терминале, пока контейнеры подняты):
   ```
   docker compose exec backend python manage.py migrate
   ```
4. Точки входа:
   - Сайт (Next.js): http://localhost:3000
   - API / админка (Django): http://localhost:8000/admin/
   - Health-check: http://localhost:8000/api/health/

## Структура репозитория

```
backend/            Django-проект
  config/           settings, urls, celery
  accounts/         пользователи и роли (менеджер/руководитель)
  leads/            заявки и воронка (мини-CRM)
  articles/         модуль статей (CMS/блог)
  kanban/           канбан-доска задач
  integrations/     адаптер интеграции с U-ON, подтяжка напоминаний в канбан
  emailing/         транзакционные письма и рассылки
  telegrambot/      Telegram-бот для менеджеров (задачи/заявки, уведомления)
  sitecontent/      управляемые изображения сайта
frontend/           Next.js приложение (публичный сайт)
docs/               исходное ТЗ
docker-compose.yml
.env.example
```

## Telegram-бот для менеджеров

Бот даёт менеджеру команды `/tasks`, `/newtask`, `/done`, `/lead`, `/sync_uon` прямо в Telegram
и присылает уведомления о назначении задачи или заявки. Отключён по умолчанию
(`TELEGRAM_BOT_ENABLED=False`) — сервис `telegram_bot` при этом просто спит, не пытаясь
переподключаться. Чтобы включить:

1. Создайте бота через [@BotFather](https://t.me/BotFather), получите токен.
2. В `.env` укажите `TELEGRAM_BOT_ENABLED=True` и `TELEGRAM_BOT_TOKEN=<токен>`.
3. Перезапустите сервис: `docker compose up -d --build telegram_bot`.
4. В Django admin создайте `TelegramAccount` для менеджера (без `chat_id`) — система
   сгенерирует `link_code`; менеджер отправляет боту `/start <код>`, чтобы привязать аккаунт.

Периодическая синхронизация напоминаний из U-ON в канбан (`celery_beat`, каждые 10 минут)
работает независимо от бота — не требует включённого `TELEGRAM_BOT_ENABLED`.

## Персональные данные и 152-ФЗ

В проде база данных (`db`) должна размещаться на сервере, физически находящемся на территории РФ. Локально это ограничение не действует — Postgres поднимается в обычном Docker-контейнере на машине разработчика.

## Внешние интеграции (мок-режим)

U-ON API и SMTP-провайдер подключены через адаптеры с флагом mock-режима (`UON_MOCK_MODE`, `EMAIL_MOCK_MODE` в `.env`) — переключение на реальные ключи выполняется без изменения кода, только через `.env`.

В реальном API U-ON нет ни одного списочного эндпоинта (`GET /{key}/request.json`, `/deal.json`, `/client.json` — все отдают 404) и нет отдельного ресурса «сделка»/«клиент»: вся воронка и данные клиента уже вложены в объект заявки, который можно получить только по ID — `GET /{key}/request/{id}.json`. Интеграция строится на вебхуках: U-ON сам вызывает `POST /api/integrations/uon/webhook/` при создании/изменении заявки, а мы по `request_id` из payload дотягиваем полные данные. Разделы CRM «Заявки» (свои Lead), «Обращения» (архивные заявки из зеркала U-ON) и «Клиенты» (собираются из полей заявки) читают то, что успело прийти через вебхук или подтянуться вручную кнопкой «Синхронизировать с U-ON» (для заявок — только по уже известным нам ID из `Lead.uon_ticket_id`, так как списком их получить нельзя).
