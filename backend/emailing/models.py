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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.email
