from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import UonRequestRecord


@receiver(pre_save, sender=UonRequestRecord)
def remember_request_status(sender, instance, raw=False, **kwargs):
    if not raw:
        instance._previous_status_name = UonRequestRecord.objects.filter(pk=instance.pk).values_list('status_name', flat=True).first() if instance.pk else None


@receiver(post_save, sender=UonRequestRecord)
def close_successful_request_tasks(sender, instance, created, raw=False, **kwargs):
    if raw:
        return
    fields = kwargs.get('update_fields')
    if fields is not None and 'status_name' not in fields:
        return
    from kanban.deals import close_successful_deal, is_successful_uon_status
    if is_successful_uon_status(instance.status_name) and not is_successful_uon_status(getattr(instance, '_previous_status_name', None)):
        # First discovery may be years-old history: close related work, but do not
        # generate past-due six-month contacts from initial imports.
        close_successful_deal(request=instance, create_follow_up=not created)
