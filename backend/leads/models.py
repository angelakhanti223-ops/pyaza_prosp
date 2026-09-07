from decimal import Decimal

from django.conf import settings
from django.db import models


class Direction(models.Model):
    """Направление / тип тура — источник для выпадающего списка на сайте и в CRM."""

    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Lead(models.Model):
    class Source(models.TextChoices):
        SITE_FORM = 'site_form', 'Сайт (форма)'
        CHATBOT = 'chatbot', 'Чат-бот'
        PHONE_CALL = 'phone_call', 'Телефонный звонок'
        OTHER = 'other', 'Другое'

    class Status(models.TextChoices):
        NEW = 'new', 'Новая'
        IN_PROGRESS = 'in_progress', 'В работе'
        OPTIONS_PROPOSED = 'options_proposed', 'Предложены варианты'
        BOOKED = 'booked', 'Бронь'
        PAID = 'paid', 'Оплачено'
        CLOSED_WON = 'closed_won', 'Закрыта (успех)'
        CLOSED_LOST = 'closed_lost', 'Закрыта (отказ)'

    name = models.CharField('Имя клиента', max_length=255)
    phone = models.CharField('Телефон', max_length=32)
    email = models.EmailField('Email', blank=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.SITE_FORM)
    direction = models.ForeignKey(
        Direction, on_delete=models.SET_NULL, null=True, blank=True, related_name='leads',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    assigned_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='leads',
    )
    deal_amount = models.DecimalField('Сумма сделки', max_digits=10, decimal_places=2, null=True, blank=True)
    commission = models.DecimalField('Комиссия', max_digits=10, decimal_places=2, null=True, blank=True)
    uon_ticket_id = models.CharField('ID обращения U-ON', max_length=64, blank=True)
    uon_request_id = models.CharField(
        'ID заявки U-ON', max_length=64, blank=True,
        help_text='Заполняется при переводе обращения в заявку (POST /request/create.json) — '
                   'отдельная сущность и ID-последовательность от uon_ticket_id.',
    )
    initial_comment = models.TextField('Комментарий из формы', blank=True)
    consent_personal_data_at = models.DateTimeField('Согласие на обработку ПДн', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.phone})'


class CommissionTier(models.Model):
    """Единая (одна на всех менеджеров и на все месяцы) лестница уровней плана —
    заменяет собой персональную «Целевую комиссию» и фиксированный
    commission_percent на MonthlyPlan (решение заказчика, 07.09.2026).
    threshold — сумма СВОЕЙ комиссии за месяц, начиная с которой засчитан этот
    уровень; commission_percent — % от своей комиссии, идущий в зарплату, пока
    держится этот уровень (см. plan_progress_rows). Ниже порога самого нижнего
    уровня всё равно применяется его commission_percent — отдельной, более
    низкой ступени для «не дотянул» нет."""

    name = models.CharField('Название уровня', max_length=50, unique=True)
    threshold = models.DecimalField('Порог (своя комиссия за месяц)', max_digits=10, decimal_places=2, unique=True)
    commission_percent = models.DecimalField('% от своей комиссии на этом уровне', max_digits=5, decimal_places=2)

    class Meta:
        ordering = ['threshold']

    def __str__(self):
        return f'{self.name} (от {self.threshold} ₽ — {self.commission_percent}%)'


class MonthlyPlan(models.Model):
    """Параметры расчёта зарплаты менеджера за месяц (решение заказчика,
    25.08.2026): оклад + % от своей комиссии (по уровню из CommissionTier,
    см. plan_progress_rows) + bonus_percent % от суммарной комиссии остальных
    держателей плана в этом месяце.

    bonus_percent — единственное поле здесь, которое нельзя посчитать
    автоматически: зависит от SLA и пропущенных ежедневных задач, а трекинга
    этого в системе пока нет, поэтому руководитель выставляет его вручную
    каждый месяц по своей оценке (3% / 1% / 0% — см. регламент)."""

    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='monthly_plans',
    )
    year = models.PositiveSmallIntegerField('Год')
    month = models.PositiveSmallIntegerField('Месяц')
    base_salary = models.DecimalField('Оклад', max_digits=10, decimal_places=2, default=Decimal('30000'))
    bonus_percent = models.DecimalField(
        '% от комиссии остальных (SLA/ежедневные задачи)', max_digits=5, decimal_places=2, default=Decimal('3'),
        help_text='По умолчанию 3% — SLA считается выполненным, если руководитель явно не указал иное. '
                   'Понижается вручную по итогам месяца: 1% при более серьёзных нарушениях, 0% при грубом '
                   'нарушении (решение заказчика, 06.09.2026 — раньше по умолчанию было 0%, из-за чего '
                   'бонус нужно было включать вручную каждый месяц, а не выключать при нарушении).',
    )

    class Meta:
        ordering = ['-year', '-month']
        unique_together = ('manager', 'year', 'month')

    def __str__(self):
        return f'{self.manager} — {self.month:02d}.{self.year}'


class WorkShift(models.Model):
    """Рабочий график менеджеров по дням — кто в этот день на смене, показывается
    внизу дашборда CRM (решение заказчика, 07.09.2026). Редактируется через
    Django admin, по одной записи на день."""

    date = models.DateField('Дата', unique=True)
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='work_shifts',
    )

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f'{self.date}: {self.manager}'


class LeadComment(models.Model):
    """Лента комментариев менеджера по ходу работы с заявкой (ТЗ 5.1, 5.4)."""

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='lead_comments',
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'Комментарий к заявке #{self.lead_id}'


class LeadStatusHistory(models.Model):
    """Аудит изменений статуса заявки (ТЗ 5.4, 13.1). Заполняется на уровне API при смене статуса."""

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='status_history')
    old_status = models.CharField(max_length=20, choices=Lead.Status.choices, blank=True)
    new_status = models.CharField(max_length=20, choices=Lead.Status.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='lead_status_changes',
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['changed_at']
        verbose_name_plural = 'Lead status history'

    def __str__(self):
        return f'#{self.lead_id}: {self.old_status} → {self.new_status}'


class LeadAttachment(models.Model):
    """Прикреплённые файлы (документы, счета) — ТЗ 5.4."""

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='lead_attachments/%Y/%m/')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file.name
