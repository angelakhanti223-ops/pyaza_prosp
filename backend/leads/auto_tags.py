from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.utils import timezone

from .models import Lead, LeadTag


@dataclass(frozen=True)
class AutoTagDefinition:
    name: str
    color: str


AUTO_TAG_DEFINITIONS = [
    AutoTagDefinition('Контроль оплаты', 'purple'),
    AutoTagDefinition('Просрочена оплата', 'red'),
    AutoTagDefinition('Выдача документов', 'gray'),
    AutoTagDefinition('Ближайший вылет', 'orange'),
    AutoTagDefinition('Просрочен контакт', 'red'),
]

AUTO_TAG_NAMES = [tag.name for tag in AUTO_TAG_DEFINITIONS]

CLOSED_STATUSES = {
    Lead.Status.CLOSED_WON,
    Lead.Status.CLOSED_LOST,
    Lead.Status.FAILED,
    Lead.Status.NOT_TARGET,
}

PAYMENT_FINISHED_STATUSES = {
    Lead.Status.PAID,
    Lead.Status.DEPARTURE,
    Lead.Status.CHECK_IN,
    Lead.Status.RETURNED,
    Lead.Status.CLOSED_WON,
}

TRIP_FINISHED_STATUSES = {
    Lead.Status.RETURNED,
    Lead.Status.CLOSED_WON,
    Lead.Status.CLOSED_LOST,
    Lead.Status.FAILED,
    Lead.Status.NOT_TARGET,
}


def ensure_auto_tags() -> dict[str, LeadTag]:
    tags: dict[str, LeadTag] = {}
    for definition in AUTO_TAG_DEFINITIONS:
        tag, _ = LeadTag.objects.update_or_create(
            name=definition.name,
            defaults={'color': definition.color, 'is_active': True},
        )
        tags[definition.name] = tag
    return tags


def get_target_auto_tag_names(lead: Lead) -> set[str]:
    now = timezone.now()
    today = timezone.localdate()
    target: set[str] = set()

    is_closed = lead.status in CLOSED_STATUSES

    if lead.next_contact_at and not is_closed and lead.next_contact_at < now:
        target.add('Просрочен контакт')

    if lead.full_payment_due_at and lead.status not in PAYMENT_FINISHED_STATUSES and not is_closed:
        if lead.full_payment_due_at < now:
            target.add('Просрочена оплата')
        elif lead.full_payment_due_at <= now + timedelta(days=7):
            target.add('Контроль оплаты')

    if lead.departure_date and lead.status not in TRIP_FINISHED_STATUSES:
        days_to_departure = (lead.departure_date - today).days
        if 0 <= days_to_departure <= 7:
            target.add('Выдача документов')
        if 0 <= days_to_departure <= 3:
            target.add('Ближайший вылет')

    return target


def sync_automatic_lead_tags(lead: Lead) -> set[str]:
    tags_by_name = ensure_auto_tags()
    target_names = get_target_auto_tag_names(lead)

    current_auto_tags = list(lead.tags.filter(name__in=AUTO_TAG_NAMES))
    current_auto_names = {tag.name for tag in current_auto_tags}

    remove_ids = [tag.id for tag in current_auto_tags if tag.name not in target_names]
    add_tags = [tags_by_name[name] for name in target_names if name not in current_auto_names]

    if remove_ids:
        lead.tags.remove(*remove_ids)
    if add_tags:
        lead.tags.add(*add_tags)

    return target_names


def sync_automatic_tags_for_all_leads() -> dict[str, int]:
    ensure_auto_tags()
    checked = 0
    changed = 0
    for lead in Lead.objects.prefetch_related('tags').all().iterator():
        before = set(lead.tags.filter(name__in=AUTO_TAG_NAMES).values_list('name', flat=True))
        after = sync_automatic_lead_tags(lead)
        checked += 1
        if before != after:
            changed += 1
    return {'checked': checked, 'changed': changed}
