import logging
import re
from urllib.parse import quote

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger('emailing')


def _send(subject: str, to: list[str], template_base: str, context: dict):
    text_body = render_to_string(f'emailing/{template_base}.txt', context)
    html_body = render_to_string(f'emailing/{template_base}.html', context)
    message = EmailMultiAlternatives(subject, text_body, settings.DEFAULT_FROM_EMAIL, to)
    message.attach_alternative(html_body, 'text/html')
    message.send()
    logger.info('Email sent: %s -> %s (mock=%s)', template_base, to, settings.EMAIL_MOCK_MODE)


def send_lead_confirmation_email(lead):
    """Клиенту: подтверждение получения заявки (ТЗ 3.2, 9.1) — опционально, см. SEND_LEAD_CONFIRMATION_EMAIL."""
    if not lead.email:
        return
    _send(
        subject='Ваша заявка принята — Слетать.ру',
        to=[lead.email],
        template_base='lead_confirmation',
        context={'lead': lead, 'site_url': settings.SITE_URL},
    )


def send_lead_notification_email(lead):
    """Менеджеру/отделу продаж: уведомление о новой заявке (ТЗ 3.2, 9.1)."""
    recipient = lead.assigned_manager.email if lead.assigned_manager and lead.assigned_manager.email else None
    to = [recipient] if recipient else [settings.SALES_NOTIFICATION_EMAIL]
    crm_url = f'{settings.SITE_URL}/crm/leads/{lead.id}'
    _send(
        subject=f'Новая заявка №{lead.id} — {lead.name}',
        to=to,
        template_base='lead_notification',
        context={'lead': lead, 'crm_url': crm_url},
    )


def _wrap_links_for_click_tracking(html: str, tracking_token) -> str:
    click_base = f'{settings.BACKEND_URL}/api/email/track/click/{tracking_token}/'

    def replace(match):
        original_url = match.group(1)
        return f'href="{click_base}?url={quote(original_url, safe="")}"'

    return re.sub(r'href="([^"]+)"', replace, html)


def send_campaign_email(send):
    """Отправляет письмо кампании одному подписчику: трекинг открытий/переходов
    и обязательная ссылка отписки (ТЗ 9.2, 152-ФЗ)."""
    campaign = send.campaign
    subscriber = send.subscriber

    unsubscribe_url = f'{settings.BACKEND_URL}/api/email/unsubscribe/{subscriber.unsubscribe_token}/'
    tracked_html = _wrap_links_for_click_tracking(campaign.body_html, send.tracking_token)
    pixel = (
        f'<img src="{settings.BACKEND_URL}/api/email/track/open/{send.tracking_token}/" '
        'width="1" height="1" alt="" style="display:none;">'
    )
    footer = (
        '<p style="font-size:11px;color:#94a3b8;margin-top:24px;">'
        f'<a href="{unsubscribe_url}" style="color:#94a3b8;">Отписаться от рассылки</a></p>'
    )
    html_body = tracked_html + footer + pixel
    text_body = strip_tags(campaign.body_html) + f'\n\nОтписаться от рассылки: {unsubscribe_url}'

    message = EmailMultiAlternatives(campaign.subject, text_body, settings.DEFAULT_FROM_EMAIL, [subscriber.email])
    message.attach_alternative(html_body, 'text/html')
    message.send()
    logger.info('Campaign email sent: %s -> %s (mock=%s)', campaign.name, subscriber.email, settings.EMAIL_MOCK_MODE)
