from django.db.models import Count
from django.http import Http404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AgentPerkGroup, Contact, Country, Destination, Hotel, SeaRegion


def _first_photo(data):
    photos = data.get('photos') or []
    return photos[0]['file'] if photos else None


def _hotel_contacts_count(data):
    contacts = data.get('hotel_contacts') or {}
    if isinstance(contacts, dict):
        return len([value for value in contacts.values() if value])
    if isinstance(contacts, list):
        return len([value for value in contacts if value])
    return 0


def hotel_summary(hotel):
    d = hotel.data
    contacts_count = getattr(hotel, 'contacts_count', None)
    if contacts_count is None:
        contacts_count = hotel.contacts.count()
    contacts_count += _hotel_contacts_count(d)
    return {
        'id': hotel.slug,
        'name': hotel.name,
        'brand': hotel.brand,
        'stars': hotel.stars,
        'category': d.get('category', ''),
        'country': hotel.country.slug,
        'country_name': hotel.country.name,
        'destination': hotel.destination.slug,
        'destination_name': hotel.destination.name,
        'area': d.get('area', ''),
        'status': hotel.status,
        'positioning': d.get('positioning', ''),
        'for_whom': hotel.for_whom,
        'detail_level': hotel.detail_level,
        'needs_check_count': len(d.get('needs_check') or []),
        'photo': _first_photo(d),
        'agent_perks_id': hotel.agent_perks_id,
        'has_agent_perks': bool(hotel.agent_perks_id or d.get('agent_programs')),
        'contacts_count': contacts_count,
    }


def destination_summary(dest):
    d = dest.data
    return {
        'id': dest.slug,
        'name': dest.name,
        'type': dest.type,
        'country': dest.country.slug,
        'description': d.get('description', ''),
        'seasonality': d.get('seasonality'),
        'hotels_count': getattr(dest, 'hotels_count', None),
        'photo': _first_photo(d),
    }


def _hotels_qs():
    return Hotel.objects.select_related('country', 'destination').prefetch_related('contacts')


class SeaOverviewView(APIView):
    """Обзор региона + страны со счётчиками."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        region = SeaRegion.load()
        countries = Country.objects.annotate(
            destinations_count=Count('destinations', distinct=True), hotels_count=Count('hotels', distinct=True),
        )
        return Response({
            'meta': region.meta,
            'region': region.region,
            'countries': [
                {
                    'id': c.slug, 'name': c.name, 'overview': c.data.get('overview', ''),
                    'destinations_count': c.destinations_count, 'hotels_count': c.hotels_count,
                    'photo': _first_photo(c.data),
                }
                for c in countries
            ],
        })


class CountryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        try:
            country = Country.objects.get(slug=slug)
        except Country.DoesNotExist:
            raise Http404
        dests = country.destinations.select_related('country').annotate(hotels_count=Count('hotels'))
        return Response({
            **country.data,
            'destinations': [destination_summary(d) for d in dests],
        })


class DestinationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        try:
            dest = Destination.objects.select_related('country').get(slug=slug)
        except Destination.DoesNotExist:
            raise Http404
        return Response({
            **dest.data,
            'country_name': dest.country.name,
            'hotels': [hotel_summary(h) for h in _hotels_qs().filter(destination=dest)],
        })


class HotelListView(APIView):
    """Все отели (краткие карточки) — фильтры и поиск делает фронтенд."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = _hotels_qs()
        for param, field in (('country', 'country__slug'), ('destination', 'destination__slug')):
            if request.query_params.get(param):
                qs = qs.filter(**{field: request.query_params[param]})
        if request.query_params.get('stars'):
            try:
                qs = qs.filter(stars=float(request.query_params['stars']))
            except ValueError:
                qs = qs.none()
        return Response([hotel_summary(h) for h in qs])


def contact_payload(contact):
    return {**contact.data, 'id': contact.slug}


def perk_group_payload(group, with_relations=True):
    payload = {**group.data, 'id': group.slug}
    if with_relations:
        slugs = group.data.get('contacts') or []
        by_slug = {c.slug: c for c in Contact.objects.filter(slug__in=slugs)}
        payload['contact_objects'] = [contact_payload(by_slug[s]) for s in slugs if s in by_slug]
        hotel_slugs = group.data.get('hotel_ids') or []
        payload['hotels'] = [
            {'id': h.slug, 'name': h.name, 'country_name': h.country.name}
            for h in _hotels_qs().filter(slug__in=hotel_slugs)
        ]
    return payload


class HotelDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        try:
            hotel = _hotels_qs().prefetch_related('contacts').get(slug=slug)
        except Hotel.DoesNotExist:
            raise Http404
        group = AgentPerkGroup.objects.filter(slug=hotel.agent_perks_id).first() if hotel.agent_perks_id else None
        return Response({
            **hotel.data,
            'country_name': hotel.country.name,
            'destination_name': hotel.destination.name,
            'contact_objects': [contact_payload(c) for c in hotel.contacts.all()],
            'agent_perks': perk_group_payload(group) if group else None,
        })


class ContactListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([contact_payload(c) for c in Contact.objects.all()])


class AgentPerksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([perk_group_payload(g) for g in AgentPerkGroup.objects.all()])
