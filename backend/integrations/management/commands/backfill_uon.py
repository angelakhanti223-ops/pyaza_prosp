import time

from django.core.management.base import BaseCommand, CommandError

from integrations.adapters import UonAdapterError
from integrations.tasks import sync_uon_lead, sync_uon_request


class Command(BaseCommand):
    help = (
        'Разовый импорт исторических обращений/заявок из U-ON по диапазону ID. '
        'В API U-ON нет списочного эндпоинта — единственный способ забрать то, что '
        'уже накопилось до подключения интеграции, это перебрать ID подряд через '
        'уже рабочие поштучные запросы (/lead/{id}.json, /request/{id}.json). '
        'ID можно взять из экспорта списка в самом U-ON (колонка "#") — но это '
        'id_system, а не настоящий id для API, так что диапазон стоит брать '
        'с запасом в обе стороны.\n\n'
        'Примеры:\n'
        '  python manage.py backfill_uon --resource lead --start 1 --end 210\n'
        '  python manage.py backfill_uon --resource request --start 1 --end 210'
    )

    def add_arguments(self, parser):
        parser.add_argument('--resource', choices=['lead', 'request'], required=True)
        parser.add_argument('--start', type=int, required=True)
        parser.add_argument('--end', type=int, required=True)
        parser.add_argument(
            '--delay', type=float, default=0.15,
            help='Пауза между запросами в секундах (лимит U-ON — не более 10 запросов/сек).',
        )

    def handle(self, *args, **options):
        resource = options['resource']
        start, end = options['start'], options['end']
        if start > end:
            raise CommandError('--start должен быть меньше или равен --end')

        sync_fn = sync_uon_lead if resource == 'lead' else sync_uon_request
        found = 0
        errors = 0
        total = end - start + 1

        for i, uon_id in enumerate(range(start, end + 1), start=1):
            try:
                if sync_fn(str(uon_id)):
                    found += 1
            except UonAdapterError as exc:
                errors += 1
                self.stderr.write(self.style.WARNING(f'{resource} {uon_id}: ошибка API — {exc}'))
            if i % 20 == 0 or i == total:
                self.stdout.write(f'{i}/{total} проверено, найдено {found}, ошибок {errors}')
            time.sleep(options['delay'])

        self.stdout.write(self.style.SUCCESS(
            f'Готово: диапазон {resource} {start}-{end}, найдено {found} из {total}, ошибок {errors}.'
        ))
