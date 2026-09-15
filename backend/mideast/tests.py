import base64
import json
import tempfile

from django.core.management import call_command
from django.test import TestCase

from .models import Airline, Country, DatasetMeta, Hotel, RixosDossier, Webinar

# 1x1 white pixel JPEG, base64-encoded — minimal valid image for photo import tests.
TINY_JPEG_B64 = (
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQ'
    'CgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=='
)


def sample_data():
    return {
        'webinars': [
            {'n': 1, 'title': 'Обзор ОАЭ', 'url': 'https://example.com/1', 'src': 'sub', 'pres': ''},
        ],
        'countries': [
            {
                'country': 'ОАЭ', 'capital': 'Абу-Даби — столица', 'visa': 'Безвизово', 'currency': 'Дирхам',
                'language': 'Арабский', 'flight': '6 часов', 'season': 'Круглый год', 'alcohol': 'В отелях',
                'dressCode': 'Свободный', 'transport': 'Такси', 'safety': 'Безопасно', 'geography': 'Пустыня',
                'emirates': [{'name': 'Дубай', 'desc': 'Хаб'}],
                'highlights': [{'name': 'Бурдж-Халифа', 'type': 'смотровая', 'emirate': 'Дубай', 'desc': '...'}],
                'events': [{'name': 'Формула-1', 'when': 'декабрь', 'desc': '...'}],
                'activities': [{'name': 'Сафари', 'desc': '...'}],
                'sellingPoints': ['Безвизово'], 'news': ['Открылся новый терминал'], 'practical': ['Карты работают'],
                'webinars': [1], 'pres': ['Presentation A'],
            },
        ],
        'airlines': [
            {
                'name': 'Emirates', 'country': 'ОАЭ', 'hub': 'DXB', 'routesFromRussia': 'Из Москвы',
                'network': 'Весь мир', 'fleet': 'A380', 'classes': 'Economy/Business', 'baggage': '30 кг',
                'loyalty': 'Skywards', 'stopover': 'Есть', 'lounges': 'Есть', 'onboard': 'Wi-Fi',
                'notes': ['Прямые рейсы'], 'webinars': [1], 'pres': [],
            },
        ],
        'hotels': [
            {
                'name': 'Test Resort', 'brand': 'Test Brand', 'country': 'ОАЭ', 'region': 'Дубай',
                'location': 'На пляже', 'category': 'luxury 5*', 'status': 'Открыт', 'rooms': '200 номеров',
                'roomMin': '30 м²', 'roomTypes': 'Standard, Suite', 'meals': 'Всё включено', 'beach': 'Собственный',
                'pools': '3 бассейна', 'kids': 'Клуб', 'spa': 'Есть', 'restaurants': '5', 'deposit': '500 AED',
                'transfer': 'Включён', 'russianStaff': 'Да', 'news': 'Реновация 2026', 'bestFor': 'Семьям',
                'webinars': [1], 'details': [{'label': 'Факт', 'value': 'Значение'}], 'pres': ['Presentation A'],
                'brandGroup': 'TestGroup', 'fAI': True, 'fKids': True, 'fBeach': True, 'fSpa': True,
                'fStatus': 'Открыт', 'fRus': True, 'fPres': True,
                'usp': ['Собственный пляж', 'Клуб для детей'], 'notFor': 'Тем, кто хочет тишины',
                'img': 'test-resort',
            },
            {
                # Без фото и почти без данных — закрытый отель, как Burj Al Arab в реальных данных.
                'name': 'Closed Hotel', 'brand': '', 'country': 'Катар', 'region': '', 'location': '',
                'category': '', 'status': 'Закрыт', 'rooms': '', 'roomMin': '', 'roomTypes': '', 'meals': '',
                'beach': '', 'pools': '', 'kids': '', 'spa': '', 'restaurants': '', 'deposit': '', 'transfer': '',
                'russianStaff': '', 'news': '', 'bestFor': '', 'webinars': [], 'details': [], 'pres': [],
                'brandGroup': '', 'fAI': False, 'fKids': False, 'fBeach': False, 'fSpa': False,
                'fStatus': 'Закрыт', 'fRus': False, 'fPres': False, 'usp': [], 'notFor': '', 'img': '',
            },
        ],
        'rixos': {
            'title': 'Rixos', 'brandOverview': 'Турецкая сеть all-inclusive', 'concepts': ['Ultra AI'],
            'kidsPrograms': ['Kids Club'], 'entertainment': ['Аниматоры'], 'hotelsList': ['Rixos Dubai'],
            'sellingPoints': ['Всё включено премиум'], 'news': ['Новый отель в 2027'],
        },
        'meta': {
            'built': 'сентябрь 2026', 'source': 'Тестовый источник', 'presCount': 2,
            'note': 'Тестовая заметка',
        },
        'images': {'test-resort': TINY_JPEG_B64},
    }


def write_sample_file():
    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8')
    json.dump(sample_data(), tmp, ensure_ascii=False)
    tmp.close()
    return tmp.name


class ImportMideastDataTests(TestCase):
    def test_import_creates_all_records(self):
        path = write_sample_file()

        call_command('import_mideast_data', path)

        self.assertEqual(Webinar.objects.count(), 1)
        self.assertEqual(Country.objects.count(), 1)
        self.assertEqual(Airline.objects.count(), 1)
        self.assertEqual(Hotel.objects.count(), 2)

        hotel = Hotel.objects.get(name='Test Resort')
        self.assertEqual(hotel.brand_group, 'TestGroup')
        self.assertTrue(hotel.f_all_inclusive)
        self.assertEqual(hotel.usp, ['Собственный пляж', 'Клуб для детей'])
        self.assertTrue(hotel.photo)

        closed = Hotel.objects.get(name='Closed Hotel')
        self.assertFalse(closed.photo)

        country = Country.objects.get(name='ОАЭ')
        self.assertEqual(country.emirates, [{'name': 'Дубай', 'desc': 'Хаб'}])

        rixos = RixosDossier.load()
        self.assertEqual(rixos.brand_overview, 'Турецкая сеть all-inclusive')

        meta = DatasetMeta.load()
        self.assertEqual(meta.presentations_count, 2)

    def test_import_is_idempotent(self):
        path = write_sample_file()

        call_command('import_mideast_data', path)
        call_command('import_mideast_data', path)

        self.assertEqual(Hotel.objects.count(), 2)
        self.assertEqual(Country.objects.count(), 1)

    def test_missing_file_reports_clear_error(self):
        from django.core.management.base import CommandError

        with self.assertRaises(CommandError):
            call_command('import_mideast_data', '/no/such/file.json')


class MideastApiTests(TestCase):
    def setUp(self):
        call_command('import_mideast_data', write_sample_file())

    def test_hotels_endpoint_is_public_and_returns_data(self):
        response = self.client.get('/api/mideast/hotels/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 2)
        names = {h['name'] for h in data}
        self.assertEqual(names, {'Test Resort', 'Closed Hotel'})

    def test_countries_endpoint(self):
        response = self.client.get('/api/mideast/countries/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_airlines_endpoint(self):
        response = self.client.get('/api/mideast/airlines/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_webinars_endpoint(self):
        response = self.client.get('/api/mideast/webinars/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_meta_endpoint_bundles_rixos_and_dataset_info(self):
        response = self.client.get('/api/mideast/meta/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['rixos']['title'], 'Rixos')
        self.assertEqual(data['dataset']['presentations_count'], 2)
