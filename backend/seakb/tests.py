import json
import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from .models import AgentPerkGroup, Contact, Country, Destination, Hotel, SeaRegion

User = get_user_model()


def sample_kb():
    photo = {'file': 'photos/thailand/h1/01_territory.jpg', 'type': 'territory', 'caption': 'x', 'is_render': False}
    return {
        'meta': {'title': 'ЮВА'},
        'region': {'name': 'ЮВА', 'overview': 'обзор'},
        'agent_perks': [{'id': 'alma', 'network': 'Alma', 'kind': 'hotel_chain', 'contacts': ['c1'], 'hotel_ids': ['h1'], 'perks': []}],
        'countries': [{
            'id': 'thailand', 'name': 'Таиланд', 'overview': 'о', 'photos': [],
            'destinations': [{
                'id': 'thailand-phuket', 'country': 'thailand', 'name': 'Пхукет', 'type': 'остров',
                'seasonality': {'months': ['best'] * 12}, 'photos': [], 'hotel_ids': ['h1'],
            }],
        }],
        'hotels': [{
            'id': 'h1', 'name': 'Hotel One', 'brand': 'B', 'stars': 5, 'country': 'thailand',
            'destination': 'thailand-phuket', 'status': 'open', 'for_whom': ['семьи'],
            'contacts': ['c1'], 'agent_perks_id': 'alma', 'photos': [photo], 'needs_check': ['цена'],
            'detail_level': 'full',
        }],
        'contacts': [{'id': 'c1', 'name': 'Иван', 'company': 'Alma', 'email': 'a@b.c', 'hotel_ids': ['h1']}],
    }


def make_folder(kb=None, with_photo=True):
    folder = Path(tempfile.mkdtemp())
    (folder / 'knowledge_base.json').write_text(json.dumps(kb or sample_kb(), ensure_ascii=False), encoding='utf-8')
    if with_photo:
        p = folder / 'photos' / 'thailand' / 'h1'
        p.mkdir(parents=True)
        (p / '01_territory.jpg').write_bytes(b'jpg')
    return str(folder)


class ImportSeaKbTests(TestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()

    def _run(self, folder):
        with override_settings(MEDIA_ROOT=self.media):
            call_command('import_sea_kb', folder)

    def test_import_creates_everything_and_copies_photos(self):
        self._run(make_folder())
        self.assertEqual(Country.objects.count(), 1)
        self.assertEqual(Destination.objects.count(), 1)
        hotel = Hotel.objects.get(slug='h1')
        self.assertEqual(hotel.contacts.count(), 1)
        self.assertEqual(hotel.agent_perks_id, 'alma')
        self.assertEqual(AgentPerkGroup.objects.count(), 1)
        self.assertEqual(SeaRegion.load().region['name'], 'ЮВА')
        self.assertTrue((Path(self.media) / 'sea' / 'photos' / 'thailand' / 'h1' / '01_territory.jpg').is_file())

    def test_idempotent_and_updates(self):
        folder = make_folder()
        self._run(folder)
        kb = sample_kb()
        kb['hotels'][0]['name'] = 'Renamed'
        Path(folder, 'knowledge_base.json').write_text(json.dumps(kb, ensure_ascii=False), encoding='utf-8')
        self._run(folder)
        self.assertEqual(Hotel.objects.count(), 1)
        self.assertEqual(Hotel.objects.get(slug='h1').name, 'Renamed')

    def test_removed_records_are_pruned(self):
        folder = make_folder()
        self._run(folder)
        kb = sample_kb()
        kb['hotels'] = []
        kb['agent_perks'] = []
        Path(folder, 'knowledge_base.json').write_text(json.dumps(kb, ensure_ascii=False), encoding='utf-8')
        self._run(folder)
        self.assertEqual(Hotel.objects.count(), 0)
        self.assertEqual(AgentPerkGroup.objects.count(), 0)

    def test_missing_photo_file_fails_before_touching_db(self):
        with self.assertRaises(CommandError):
            self._run(make_folder(with_photo=False))
        self.assertEqual(Hotel.objects.count(), 0)

    def test_missing_folder(self):
        with self.assertRaises(CommandError):
            self._run('/no/such/folder')


class SeaKbApiTests(TestCase):
    def setUp(self):
        with override_settings(MEDIA_ROOT=tempfile.mkdtemp()):
            call_command('import_sea_kb', make_folder())
        self.user = User.objects.create_user(username='seamanager', password='x', role=User.Role.MANAGER)

    def test_anonymous_gets_401_or_403(self):
        for url in (
            '/api/sea-kb/overview/', '/api/sea-kb/hotels/', '/api/sea-kb/hotels/h1/',
            '/api/sea-kb/contacts/', '/api/sea-kb/agent-perks/', '/api/sea-kb/countries/thailand/',
            '/api/sea-kb/destinations/thailand-phuket/',
        ):
            self.assertIn(self.client.get(url).status_code, (401, 403), url)

    def test_manager_can_read_everything(self):
        self.client.force_login(self.user)
        overview = self.client.get('/api/sea-kb/overview/').json()
        self.assertEqual(overview['countries'][0]['hotels_count'], 1)

        country = self.client.get('/api/sea-kb/countries/thailand/').json()
        self.assertEqual(country['destinations'][0]['hotels_count'], 1)

        dest = self.client.get('/api/sea-kb/destinations/thailand-phuket/').json()
        self.assertEqual(dest['hotels'][0]['id'], 'h1')
        self.assertEqual(dest['hotels'][0]['needs_check_count'], 1)

        hotel = self.client.get('/api/sea-kb/hotels/h1/').json()
        self.assertEqual(hotel['contact_objects'][0]['name'], 'Иван')
        self.assertEqual(hotel['agent_perks']['network'], 'Alma')
        self.assertEqual(hotel['agent_perks']['hotels'][0]['id'], 'h1')

        self.assertEqual(len(self.client.get('/api/sea-kb/hotels/?stars=5').json()), 1)
        self.assertEqual(len(self.client.get('/api/sea-kb/hotels/?stars=3').json()), 0)
        self.assertEqual(len(self.client.get('/api/sea-kb/contacts/').json()), 1)
        self.assertEqual(len(self.client.get('/api/sea-kb/agent-perks/').json()), 1)

    def test_unknown_slug_404(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/api/sea-kb/hotels/nope/').status_code, 404)
