import uuid

from django.conf import settings
from django.db import models


class EmailSubscriber(models.Model):
    """База подписчиков рассылки (ТЗ 9.2). Хранит согласие на получение писем — требование 152-ФЗ."""

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True)
    interests = models.ManyToManyField('leads.Direction', blank=True, related_name='subscribers')
    source_lead = models.ForeignKey(
        'leads.Lead', on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    is_active = models.BooleanField(default=True)
    consented_at = models.DateTimeField(null=True, blank=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)
    unsubscribe_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.email


class EmailCampaign(models.Model):
    """Маркетинговая рассылка (ТЗ 9.2): конструктор писем + сегментация по интересам."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Черновик'
        SENDING = 'sending', 'Отправляется'
        SENT = 'sent', 'Отправлено'

    name = models.CharField(max_length=255)
    subject = models.CharField(max_length=255)
    body_html = models.TextField(help_text='HTML письма. Ссылка отписки добавляется автоматически.')

    # Сегментация: пусто = все активные подписчики с согласием; иначе — пересечение по интересам.
    target_interests = models.ManyToManyField('leads.Direction', blank=True, related_name='campaigns')

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def recipients(self):
        qs = EmailSubscriber.objects.filter(is_active=True, consented_at__isnull=False)
        if self.target_interests.exists():
            qs = qs.filter(interests__in=self.target_interests.all()).distinct()
        return qs


class EmailSend(models.Model):
    """Лог отправки письма конкретному подписчику — основа статистики открытий/переходов (ТЗ 9.2)."""

    campaign = models.ForeignKey(EmailCampaign, on_delete=models.CASCADE, related_name='sends')
    subscriber = models.ForeignKey(EmailSubscriber, on_delete=models.CASCADE, related_name='email_sends')
    tracking_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    sent_at = models.DateTimeField(auto_now_add=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-sent_at']
        constraints = [
            models.UniqueConstraint(fields=['campaign', 'subscriber'], name='unique_campaign_subscriber'),
        ]

    def __str__(self):
        return f'{self.campaign.name} → {self.subscriber.email}'
