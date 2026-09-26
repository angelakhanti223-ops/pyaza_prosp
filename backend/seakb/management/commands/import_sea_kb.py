import json
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from seakb.models import AgentPerkGroup, Contact, Country, Destination, Hotel, SeaRegion


class Command(BaseCommand):
    help = (
        'Импорт базы знаний ЮВА: import_sea_kb <папка с knowledge_base.json и photos/>. '
        'Идемпотентно (update_or_create по id из JSON): при обновлении JSON просто запустите '
        'заново. JSON — источник истины: записи, которых в нём больше нет, удаляются. '
        'Фото копируются в MEDIA_ROOT/sea/ с сохранением путей (photos/...).'
    )

    def add_arguments(self, parser):
        parser.add_argument('folder', type=str, help='Папка ЮВА_база_знаний (knowledge_base.json + photos/)')

    def handle(self, *args, **options):
        folder = Path(options['folder'])
        json_path = folder / 'knowledge_base.json'
        if not json_path.is_file():
            raise CommandError(f'Не найден {json_path}')
        try:
            kb = json.loads(json_path.read_text(encoding='utf-8'))
        except json.JSONDecodeError as exc:
            raise CommandError(f'Не удалось разобрать JSON: {exc}')

        self._check_photos(kb, folder)

        with transaction.atomic():
            counts = self._import(kb)
        copied = self._copy_photos(folder)

        self.stdout.write(self.style.SUCCESS(
            'Готово: стран {countries}, направлений {destinations}, отелей {hotels}, '
            'контактов {contacts}, групп плюшек {perks}; файлов фото скопировано: {photos}.'.format(
                photos=copied, **counts,
            ),
        ))

    def _photo_files(self, kb):
        for country in kb.get('countries', []):
            for p in country.get('photos', []):
                yield p['file']
            for dest in country.get('destinations', []):
                for p in dest.get('photos', []):
                    yield p['file']
        for hotel in kb.get('hotels', []):
            for p in hotel.get('photos', []):
                yield p['file']

    def _check_photos(self, kb, folder):
        missing = sorted({f for f in self._photo_files(kb) if not (folder / f).is_file()})
        if missing:
            raise CommandError(
                f'В JSON указано {len(missing)} несуществующих файлов фото, например: {", ".join(missing[:5])}',
            )

    def _copy_photos(self, folder):
        src = folder / 'photos'
        dst = Path(settings.MEDIA_ROOT) / 'sea' / 'photos'
        if not src.is_dir():
            return 0
        dst.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src, dst, dirs_exist_ok=True)
        return sum(1 for f in dst.rglob('*') if f.is_file())

    def _import(self, kb):
        region = SeaRegion.load()
        region.meta = kb.get('meta', {})
        region.region = kb.get('region', {})
        region.save()

        contacts = {}
        for c in kb.get('contacts', []):
            obj, _ = Contact.objects.update_or_create(
                slug=c['id'], defaults={'name': c['name'], 'company': c.get('company', ''), 'data': c},
            )
            contacts[c['id']] = obj
        Contact.objects.exclude(slug__in=contacts).delete()

        perk_slugs = []
        for order, g in enumerate(kb.get('agent_perks', [])):
            AgentPerkGroup.objects.update_or_create(
                slug=g['id'],
                defaults={'network': g['network'], 'kind': g.get('kind', ''), 'order': order, 'data': g},
            )
            perk_slugs.append(g['id'])
        AgentPerkGroup.objects.exclude(slug__in=perk_slugs).delete()

        country_objs, dest_objs, dest_count = {}, {}, 0
        for c_order, c in enumerate(kb.get('countries', [])):
            country, _ = Country.objects.update_or_create(
                slug=c['id'],
                defaults={
                    'name': c['name'], 'order': c_order,
                    'data': {k: v for k, v in c.items() if k != 'destinations'},
                },
            )
            country_objs[c['id']] = country
            for d_order, d in enumerate(c.get('destinations', [])):
                dest, _ = Destination.objects.update_or_create(
                    slug=d['id'],
                    defaults={
                        'country': country, 'name': d['name'], 'type': d.get('type', ''),
                        'order': d_order, 'data': d,
                    },
                )
                dest_objs[d['id']] = dest
                dest_count += 1
        Destination.objects.exclude(slug__in=dest_objs).delete()
        Country.objects.exclude(slug__in=country_objs).delete()

        hotel_slugs = []
        for h in kb.get('hotels', []):
            try:
                country = country_objs[h['country']]
                destination = dest_objs[h['destination']]
            except KeyError as exc:
                raise CommandError(f'Отель {h["id"]}: неизвестная страна/направление {exc}')
            hotel, _ = Hotel.objects.update_or_create(
                slug=h['id'],
                defaults={
                    'name': h['name'], 'brand': h.get('brand') or '', 'stars': h.get('stars'),
                    'country': country, 'destination': destination,
                    'status': h.get('status') or '', 'detail_level': h.get('detail_level') or '',
                    'agent_perks_id': h.get('agent_perks_id') or '',
                    'for_whom': h.get('for_whom') or [], 'data': h,
                },
            )
            unknown = [cid for cid in h.get('contacts', []) if cid not in contacts]
            if unknown:
                raise CommandError(f'Отель {h["id"]}: неизвестные контакты {unknown}')
            hotel.contacts.set([contacts[cid] for cid in h.get('contacts', [])])
            hotel_slugs.append(h['id'])
        Hotel.objects.exclude(slug__in=hotel_slugs).delete()

        return {
            'countries': len(country_objs), 'destinations': dest_count, 'hotels': len(hotel_slugs),
            'contacts': len(contacts), 'perks': len(perk_slugs),
        }
