from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

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
        old = Task.all_objects.filter(pk=instance.pk).values('deadline', 'status', 'assignee_id', 'archived_at').first() if instance.pk else None
        instance._previous_task = old
        instance._previous_deadline = old['deadline'] if old else None


@receiver(post_save, sender=Task)
def sync_task_contact_date(sender, instance, created, raw=False, **kwargs):
    if raw or instance.origin != Task.Origin.NEXT_CONTACT or not instance.lead_id:
        return
    previous = getattr(instance, '_previous_deadline', instance.deadline)
    old = getattr(instance, '_previous_task', None)
    changed = 0
    if task_is_closed(instance):
        dates = [value for value in [previous, instance.deadline] if value is not None]
        if dates:
            changed += Lead.objects.filter(pk=instance.lead_id, next_contact_at__in=dates).update(next_contact_at=None, updated_at=timezone.now())
    elif not created and previous != instance.deadline:
        changed += Lead.objects.filter(pk=instance.lead_id, next_contact_at=previous).update(next_contact_at=instance.deadline, updated_at=timezone.now())
    elif old and (old['status'] in [Task.Status.DONE, Task.Status.CANCELLED] or old['archived_at']) and instance.deadline:
        changed += Lead.objects.filter(pk=instance.lead_id, next_contact_at=None).update(next_contact_at=instance.deadline, updated_at=timezone.now())
    if old and old['assignee_id'] != instance.assignee_id:
        changed += Lead.objects.filter(pk=instance.lead_id).update(assigned_manager_id=instance.assignee_id, updated_at=timezone.now())
    if changed:
        from .auto_tags import sync_automatic_lead_tags
        sync_automatic_lead_tags(Lead.objects.get(pk=instance.lead_id))


@receiver(post_delete, sender=Task)
def clear_deleted_contact_task(sender, instance, **kwargs):
    if instance.origin == Task.Origin.NEXT_CONTACT and instance.lead_id and instance.deadline:
        if Lead.objects.filter(pk=instance.lead_id, next_contact_at=instance.deadline).update(next_contact_at=None, updated_at=timezone.now()):
            from .auto_tags import sync_automatic_lead_tags
            sync_automatic_lead_tags(Lead.objects.get(pk=instance.lead_id))
