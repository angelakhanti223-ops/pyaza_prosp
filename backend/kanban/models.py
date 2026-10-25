from django.conf import settings
from django.db import models


class ActiveTaskManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(archived_at__isnull=True)


class TaskStatus(models.TextChoices):
    NEW = 'new', 'Новая'
    IN_PROGRESS = 'in_progress', 'В работе'
    WAITING_CLIENT = 'waiting_client', 'Ждём клиента'
    POSTPONED = 'postponed', 'Отложено'
    DONE = 'done', 'Выполнено'
    CANCELLED = 'cancelled', 'Отменено'


class KanbanColumn(models.Model):
    """A column represents exactly one task status; inactive legacy columns are retained."""

    name = models.CharField(max_length=100)
    order = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=TaskStatus.choices, unique=True, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.status:
            self.name = TaskStatus(self.status).label
            if kwargs.get('update_fields') is not None:
                kwargs['update_fields'] = set(kwargs['update_fields']) | {'name'}
        return super().save(*args, **kwargs)


class Task(models.Model):
    class Origin(models.TextChoices):
        MANUAL = 'manual', 'Ручная / прежняя локальная'
        UON = 'uon_import', 'Импорт напоминания U-ON'
        NEXT_CONTACT = 'next_contact', 'Следующий контакт'
        AFTER_SALE = 'after_sale', 'После успешной сделки'

    class Purpose(models.TextChoices):
        GENERAL = 'general', 'Работа по заявке'
        DOCUMENTS = 'documents', 'Выдача документов'
        FOLLOW_UP_6M = 'follow_up_6m', 'Связь через полгода'

    objects = ActiveTaskManager()
    all_objects = models.Manager()
    Status = TaskStatus

    class ContactChannel(models.TextChoices):
        PHONE = 'phone', 'Телефон'
        EMAIL = 'email', 'e-mail'
        MAX = 'max', 'MAX'
        TELEGRAM = 'telegram', 'Telegram'
        WHATSAPP = 'whatsapp', 'Whatsapp'
        VK = 'vk', 'VK'

    title = models.CharField(max_length=255)
    origin = models.CharField(max_length=20, choices=Origin.choices, default=Origin.MANUAL)
    automation_key = models.CharField(max_length=128, unique=True, null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True, db_index=True)
    description = models.TextField(blank=True)
    purpose = models.CharField('Назначение задачи', max_length=20, choices=Purpose.choices, default=Purpose.GENERAL)
    closed_at = models.DateTimeField('Закрыта', null=True, blank=True)
    closure_reason = models.CharField('Причина закрытия', max_length=20, blank=True, choices=[('manual', 'Закрыта сотрудником'), ('deal_won', 'Сделка успешна')])
    status = models.CharField(
        'Статус задачи', max_length=20, choices=Status.choices, default=Status.NEW,
        help_text='Единое состояние задачи: соответствует колонке канбана. При первом переводе в «Отложено» неизменённый срок сдвигается на 3 дня.',
    )
    preferred_contact_channel = models.CharField(
        'Приоритетный канал связи', max_length=20, choices=ContactChannel.choices, blank=True,
    )
    column = models.ForeignKey(KanbanColumn, on_delete=models.PROTECT, related_name='tasks')
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='kanban_tasks',
    )
    lead = models.ForeignKey(
        'leads.Lead', on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks',
    )
    uon_reminder_id = models.CharField(
        'ID напоминания U-ON', max_length=64, unique=True, null=True, blank=True,
        help_text='Заполняется автоматически при синхронизации напоминаний из U-ON — не редактировать вручную.',
    )
    uon_record_kind = models.CharField(
        'Тип записи U-ON', max_length=10, blank=True,
        choices=[('request', 'Заявка'), ('lead', 'Обращение')],
        help_text='К какой сущности U-ON относится задача — для ссылки «Открыть в U-ON».',
    )
    uon_record_id = models.CharField('ID записи U-ON', max_length=64, blank=True)
    is_recurring = models.BooleanField(
        'Ежедневная (повторяющаяся)', default=False,
        help_text='При выполнении создаётся одна следующая задача. Отмена не создаёт повтор.',
    )
    recurrence_parent = models.OneToOneField('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='recurrence_next')
    deadline = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['column', 'order']
        base_manager_name = 'all_objects'
        default_manager_name = 'objects'

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        from .services import save_task
        return save_task(self, super().save, *args, **kwargs)

    @property
    def kind(self) -> str:
        """Тип задачи для цветовой маркировки доски: заявка / обращение / общая."""
        if self.lead_id or self.uon_record_kind == 'request':
            return 'lead'
        if self.uon_reminder_id or self.uon_record_kind == 'lead':
            return 'appeal'
        return 'general'

    @property
    def priority(self) -> str | None:
        """Автоматическая бирка срочности — заявки и обращения всегда горят, ежедневные
        задачи важны, но не срочны, остальные общие задачи без метки."""
        if self.archived_at or self.status in [Task.Status.DONE, Task.Status.CANCELLED]:
            return None
        if self.purpose == self.Purpose.FOLLOW_UP_6M:
            return 'important'
        if self.kind in ('lead', 'appeal'):
            return 'urgent_important'
        if self.is_recurring:
            return 'important'
        return None


class TaskAttachment(models.Model):
    """Файлы, прикреплённые к задаче на канбан-доске (по аналогии с leads.LeadAttachment)."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='task_attachments/%Y/%m/')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file.name


class WebPushKey(models.Model):
    """Server-only VAPID identity, generated once and shared by API/worker."""
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    private_key = models.TextField()
    public_key = models.CharField(max_length=128)


class WebPushSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    session_key = models.CharField(max_length=64)
    endpoint_hash = models.CharField(max_length=64, unique=True)
    endpoint = models.TextField()
    p256dh = models.CharField(max_length=128)
    auth = models.CharField(max_length=64)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class TaskPushReceipt(models.Model):
    subscription = models.ForeignKey(WebPushSubscription, on_delete=models.CASCADE)
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    deadline = models.DateTimeField()
    sent_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    retry_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['subscription', 'task', 'deadline'], name='unique_task_push_deadline')]
