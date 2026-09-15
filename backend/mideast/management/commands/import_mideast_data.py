import base64
import json

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from mideast.models import Airline, Country, DatasetMeta, Hotel, RixosDossier, Webinar


class Command(BaseCommand):
    help = (
        'Загружает базу отелей Ближнего Востока из JSON-выгрузки '
        '(hotels/countries/airlines/webinars/rixos/meta/images) — идемпотентно, '
        'повторный запуск обновляет существующие записи, а не дублирует их.'
    )

    def add_arguments(self, parser):
        parser.add_argument('json_path', type=str, help='Путь к файлу База_Ближний_Восток_данные.json')

    def handle(self, *args, **options):
        path = options['json_path']
        try:
            with open(path, encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            raise CommandError(f'Файл не найден: {path}')
        except json.JSONDecodeError as exc:
            raise CommandError(f'Не удалось разобрать JSON: {exc}')

        images = data.get('images', {})

        webinar_count = self._import_webinars(data.get('webinars', []))
        country_count = self._import_countries(data.get('countries', []))
        airline_count = self._import_airlines(data.get('airlines', []))
        hotel_count = self._import_hotels(data.get('hotels', []), images)
        self._import_rixos(data.get('rixos', {}))
        self._import_meta(data.get('meta', {}))

        self.stdout.write(self.style.SUCCESS(
            f'Готово: вебинаров {webinar_count}, стран {country_count}, '
            f'авиакомпаний {airline_count}, отелей {hotel_count}.',
        ))

    def _import_webinars(self, items):
        count = 0
        for item in items:
            Webinar.objects.update_or_create(
                number=item['n'],
                defaults={
                    'title': item.get('title', ''),
                    'url': item.get('url', ''),
                    'src': item.get('src', ''),
                    'presentation': item.get('pres', ''),
                },
            )
            count += 1
        return count

    def _import_countries(self, items):
        count = 0
        for order, item in enumerate(items):
            Country.objects.update_or_create(
                name=item['country'],
                defaults={
                    'capital': item.get('capital', ''),
                    'visa': item.get('visa', ''),
                    'currency': item.get('currency', ''),
                    'language': item.get('language', ''),
                    'flight': item.get('flight', ''),
                    'season': item.get('season', ''),
                    'alcohol': item.get('alcohol', ''),
                    'dress_code': item.get('dressCode', ''),
                    'transport': item.get('transport', ''),
                    'safety': item.get('safety', ''),
                    'geography': item.get('geography', ''),
                    'emirates': item.get('emirates', []),
                    'highlights': item.get('highlights', []),
                    'events': item.get('events', []),
                    'activities': item.get('activities', []),
                    'selling_points': item.get('sellingPoints', []),
                    'news': item.get('news', []),
                    'practical': item.get('practical', []),
                    'webinar_numbers': item.get('webinars', []),
                    'presentations': item.get('pres', []),
                    'order': order,
                },
            )
            count += 1
        return count

    def _import_airlines(self, items):
        count = 0
        for order, item in enumerate(items):
            Airline.objects.update_or_create(
                name=item['name'],
                defaults={
                    'country': item.get('country', ''),
                    'hub': item.get('hub', ''),
                    'routes_from_russia': item.get('routesFromRussia', ''),
                    'network': item.get('network', ''),
                    'fleet': item.get('fleet', ''),
                    'classes': item.get('classes', ''),
                    'baggage': item.get('baggage', ''),
                    'loyalty': item.get('loyalty', ''),
                    'stopover': item.get('stopover', ''),
                    'lounges': item.get('lounges', ''),
                    'onboard': item.get('onboard', ''),
                    'notes': item.get('notes', []),
                    'webinar_numbers': item.get('webinars', []),
                    'presentations': item.get('pres', []),
                    'order': order,
                },
            )
            count += 1
        return count

    def _import_hotels(self, items, images):
        count = 0
        for item in items:
            hotel, _ = Hotel.objects.update_or_create(
                name=item['name'], country=item.get('country', ''),
                defaults={
                    'brand': item.get('brand', ''),
                    'brand_group': item.get('brandGroup', ''),
                    'region': item.get('region', ''),
                    'location': item.get('location', ''),
                    'category': item.get('category', ''),
                    'status': item.get('status', ''),
                    'rooms': item.get('rooms', ''),
                    'room_min': item.get('roomMin', ''),
                    'room_types': item.get('roomTypes', ''),
                    'meals': item.get('meals', ''),
                    'beach': item.get('beach', ''),
                    'pools': item.get('pools', ''),
                    'kids': item.get('kids', ''),
                    'spa': item.get('spa', ''),
                    'restaurants': item.get('restaurants', ''),
                    'deposit': item.get('deposit', ''),
                    'transfer': item.get('transfer', ''),
                    'russian_staff': item.get('russianStaff', ''),
                    'news': item.get('news', ''),
                    'best_for': item.get('bestFor', ''),
                    'not_for': item.get('notFor', ''),
                    'usp': item.get('usp', []),
                    'details': item.get('details', []),
                    'webinar_numbers': item.get('webinars', []),
                    'presentations': item.get('pres', []),
                    'f_all_inclusive': bool(item.get('fAI')),
                    'f_kids_friendly': bool(item.get('fKids')),
                    'f_beach': bool(item.get('fBeach')),
                    'f_spa': bool(item.get('fSpa')),
                    'f_russian_staff': bool(item.get('fRus')),
                    'f_has_presentation': bool(item.get('fPres')),
                    'status_flag': item.get('fStatus', ''),
                },
            )

            img_key = item.get('img')
            if img_key and img_key in images:
                image_bytes = base64.b64decode(images[img_key])
                hotel.photo.save(f'{img_key}.jpg', ContentFile(image_bytes), save=True)

            count += 1
        return count

    def _import_rixos(self, item):
        if not item:
            return
        dossier = RixosDossier.load()
        dossier.title = item.get('title', 'Rixos')
        dossier.brand_overview = item.get('brandOverview', '')
        dossier.concepts = item.get('concepts', [])
        dossier.kids_programs = item.get('kidsPrograms', [])
        dossier.entertainment = item.get('entertainment', [])
        dossier.hotels_list = item.get('hotelsList', [])
        dossier.selling_points = item.get('sellingPoints', [])
        dossier.news = item.get('news', [])
        dossier.save()

    def _import_meta(self, item):
        if not item:
            return
        meta = DatasetMeta.load()
        meta.built = item.get('built', '')
        meta.source = item.get('source', '')
        meta.presentations_count = item.get('presCount', 0)
        meta.note = item.get('note', '')
        meta.save()
