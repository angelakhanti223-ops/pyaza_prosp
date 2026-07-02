import logging

from celery import shared_task
from django.utils import timezone

from .emails import send_campaign_email, send_lead_confirmation_email, send_lead_notification_email

logger = logging.getLogger('emailing')


@shared_task(bind=True, max_retries=3, retry_backoff=30)
def send_lead_confirmation_task(self, lead_id):
    from leads.models import Lead

    try:
        lead = Lead.objects.get(pk=lead_id)
    except Lead.DoesNotExist:
        logger.warning('send_lead_confirmation_task: заявка #%s не найдена', lead_id)
        return
    send_lead_confirmation_email(lead)


@shared_task(bind=True, max_retries=3, retry_backoff=30)
def send_lead_notification_task(self, lead_id):
    from leads.models import Lead

    try:
        lead = Lead.objects.select_related('assigned_manager', 'direction').get(pk=lead_id)
    except Lead.DoesNotExist:
        logger.warning('send_lead_notification_task: заявка #%s не найдена', lead_id)
        return
    send_lead_notification_email(lead)


@shared_task
def send_campaign_task(campaign_id):
    """Ставит письмо кампании в очередь для каждого получателя сегмента (ТЗ 9.2)."""
    from .models import EmailCampaign, EmailSend

    campaign = EmailCampaign.objects.get(pk=campaign_id)
    campaign.status = EmailCampaign.Status.SENDING
    campaign.save(update_fields=['status'])

    for subscriber in campaign.recipients():
        send, _ = EmailSend.objects.get_or_create(campaign=campaign, subscriber=subscriber)
        send_single_campaign_email_task.delay(send.id)

    campaign.status = EmailCampaign.Status.SENT
    campaign.sent_at = timezone.now()
    campaign.save(update_fields=['status', 'sent_at'])


@shared_task(bind=True, max_retries=3, retry_backoff=30)
def send_single_campaign_email_task(self, send_id):
    from .models import EmailSend

    send = EmailSend.objects.select_related('campaign', 'subscriber').get(pk=send_id)
    send_campaign_email(send)
