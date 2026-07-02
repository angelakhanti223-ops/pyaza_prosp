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
  integrations/     адаптер интеграции с U-ON
  emailing/         транзакционные письма и рассылки
frontend/           Next.js приложение (публичный сайт)
docs/               исходное ТЗ
docker-compose.yml
.env.example
```

## Персональные данные и 152-ФЗ

В проде база данных (`db`) должна размещаться на сервере, физически находящемся на территории РФ. Локально это ограничение не действует — Postgres поднимается в обычном Docker-контейнере на машине разработчика.

## Внешние интеграции (мок-режим)

U-ON API и SMTP-провайдер пока недоступны (нет ключей/аккаунтов). Оба подключены через адаптеры с флагом mock-режима (`UON_MOCK_MODE`, `EMAIL_MOCK_MODE` в `.env`) — переключение на реальные ключи выполняется без изменения кода, только через `.env`.
