import uuid

from django.db import models
from django.utils import timezone


class Candidate(models.Model):
    class Status(models.TextChoices):
        NEW = 'new', 'Новая анкета'
        REVIEW = 'review', 'На рассмотрении'
        INTERVIEW = 'interview', 'Собеседование'
        HIRED = 'hired', 'Принят'
        REJECTED = 'rejected', 'Отказ'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request_id = models.UUIDField(unique=True, editable=False)
    full_name = models.CharField(max_length=902)
    phone = models.CharField(max_length=25)
    email = models.EmailField(blank=True)
    position = models.CharField(max_length=300)
    city = models.CharField(max_length=300)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    notes = models.TextField(blank=True)
    data = models.JSONField()
    consent_version = models.CharField(max_length=100)
    consent_text = models.TextField()
    consent_sha256 = models.CharField(max_length=64)
    consent_at = models.DateTimeField(default=timezone.now, editable=False)
    # Private logical folder: bytes live in Postgres, never in public MEDIA_ROOT.
    pdf_content = models.BinaryField(editable=False)
    created_at = models.DateTimeField(default=timezone.now, editable=False, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Анкета кандидата'
        verbose_name_plural = 'Анкеты кандидатов'

    def __str__(self):
        return self.full_name
