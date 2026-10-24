from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from kanban.models import Task
from kanban.services import sync_next_contact_task, task_is_closed
from .models import Lead


@receiver(pre_save, sender=Lead)
def remember_contact_date(sender, instance, raw=False, **kwargs):
    if not raw:
        instance._previous_contact_at = Lead.objects.filter(pk=instance.pk).values_list('next_contact_at', flat=True).first() if instance.pk else None


@receiver(post_save, sender=Lead)
def sync_contact_task(sender, instance, created, raw=False, **kwargs):
    if not raw:
        sync_next_contact_task(instance.pk, allow_create=created or getattr(instance, '_previous_contact_at', None) != instance.next_contact_at)


@receiver(pre_save, sender=Task)
def remember_task_date(sender, instance, raw=False, **kwargs):
    if not raw and instance.origin == Task.Origin.NEXT_CONTACT:
        instance._previous_deadline = Task.all_objects.filter(pk=instance.pk).values_list('deadline', flat=True).first() if instance.pk else None


@receiver(post_save, sender=Task)
def sync_task_contact_date(sender, instance, created, raw=False, **kwargs):
    if raw or instance.origin != Task.Origin.NEXT_CONTACT or not instance.lead_id:
        return
    previous = getattr(instance, '_previous_deadline', instance.deadline)
    if task_is_closed(instance):
        if instance.deadline is not None:
            Lead.objects.filter(pk=instance.lead_id, next_contact_at=instance.deadline).update(next_contact_at=None)
    elif not created and previous != instance.deadline:
        Lead.objects.filter(pk=instance.lead_id, next_contact_at=previous).update(next_contact_at=instance.deadline)


@receiver(post_delete, sender=Task)
def clear_deleted_contact_task(sender, instance, **kwargs):
    if instance.origin == Task.Origin.NEXT_CONTACT and instance.lead_id and instance.deadline:
        Lead.objects.filter(pk=instance.lead_id, next_contact_at=instance.deadline).update(next_contact_at=None)
