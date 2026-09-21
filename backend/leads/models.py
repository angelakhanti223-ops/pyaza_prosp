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


class TourOperator(models.Model):
    """Справочник туроператоров для CRM: бренд, юридические данные, реестр и реквизиты.

    Используется как отдельная сущность, чтобы в заявке выбирать туроператора из списка,
    а не вводить каждый раз вручную. Старое текстовое поле Lead.tour_operator сохранено
    для совместимости с уже созданными заявками.
    """

    brand_name = models.CharField('Бренд / название для выбора', max_length=120, unique=True)
    legal_name = models.CharField('Юридическое наименование', max_length=255, blank=True)
    inn = models.CharField('ИНН', max_length=20, blank=True)
    ogrn = models.CharField('ОГРН', max_length=20, blank=True)
    registry_number = models.CharField('Реестровый номер туроператора', max_length=64, blank=True)
    activity_scope = models.CharField('Сфера деятельности', max_length=255, blank=True)
    website = models.URLField('Сайт', blank=True)
    phone = models.CharField('Телефон', max_length=100, blank=True)
    email = models.EmailField('Email', blank=True)
    address = models.TextField('Юридический / почтовый адрес', blank=True)
    payment_details = models.TextField('Реквизиты / договорные данные', blank=True)
    note = models.TextField('Примечание', blank=True)
    is_active = models.BooleanField('Активен', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['brand_name']

    def __str__(self):
        return self.brand_name


class TourOperatorExchangeRate(models.Model):
    """Курс валюты конкретного туроператора на дату.

    У разных туроператоров внутренний курс может отличаться от ЦБ и друг от друга,
    поэтому курс хранится отдельно по каждому ТО, валюте и дате.
    """

    class Currency(models.TextChoices):
        RUB = 'RUB', 'RUB — рубль'
        USD = 'USD', 'USD — доллар США'
        EUR = 'EUR', 'EUR — евро'
        CNY = 'CNY', 'CNY — юань'
        AED = 'AED', 'AED — дирхам ОАЭ'
        THB = 'THB', 'THB — бат'
        TRY = 'TRY', 'TRY — турецкая лира'
        OTHER = 'OTHER', 'Другая валюта'

    operator = models.ForeignKey(
        TourOperator, on_delete=models.CASCADE, related_name='exchange_rates', verbose_name='Туроператор',
    )
    currency = models.CharField('Валюта', max_length=10, choices=Currency.choices)
    rate = models.DecimalField('Курс туроператора', max_digits=12, decimal_places=4)
    rate_date = models.DateField('Дата курса')
    source_url = models.URLField('Ссылка на источник курса', blank=True)
    source_note = models.CharField('Комментарий / источник курса', max_length=255, blank=True)
    is_active = models.BooleanField('Активен', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['operator__brand_name', 'currency', '-rate_date']
        unique_together = ('operator', 'currency', 'rate_date')
        indexes = [
            models.Index(fields=['operator', 'currency', 'rate_date']),
        ]

    def __str__(self):
        return f'{self.operator} — {self.currency} {self.rate} на {self.rate_date}'


class LeadTag(models.Model):
    """Метка заявки для сегментации, контроля и будущих рассылок."""

    name = models.CharField('Название метки', max_length=80, unique=True)
    color = models.CharField('Цвет', max_length=20, blank=True, help_text='CSS-цвет или служебное имя цвета')
    is_active = models.BooleanField('Активна', default=True)
    created_at = models.DateTimeField(auto_now_add=True)

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
        FOLLOW_UP = 'follow_up', 'Назначена повторная связь'
        IN_PROGRESS = 'in_progress', 'В работе'
        SELECTION = 'selection', 'Подборка'
        OPTIONS_PROPOSED = 'options_proposed', 'Предложены варианты'
        BOOKED = 'booked', 'Бронь'
        PREPAID = 'prepaid', 'Внесена предоплата'
        WAITING_PAYMENT = 'waiting_payment', 'Ожидаем полной оплаты'
        PAID = 'paid', 'Оплачено'
        DEPARTURE = 'departure', 'Вылет'
        CHECK_IN = 'check_in', 'Заселение'
        RETURNED = 'returned', 'Прилет'
        CLOSED_WON = 'closed_won', 'Успешная'
        CLOSED_LOST = 'closed_lost', 'Неуспешная'
        FAILED = 'failed', 'Провалена'
        NOT_TARGET = 'not_target', 'Нецелевой'

    class Currency(models.TextChoices):
        RUB = 'RUB', 'RUB — рубль'
        USD = 'USD', 'USD — доллар США'
        EUR = 'EUR', 'EUR — евро'
        CNY = 'CNY', 'CNY — юань'
        AED = 'AED', 'AED — дирхам ОАЭ'
        THB = 'THB', 'THB — бат'
        TRY = 'TRY', 'TRY — турецкая лира'
        OTHER = 'OTHER', 'Другая валюта'

    class Messenger(models.TextChoices):
        PHONE = 'phone', 'Телефон'
        WHATSAPP = 'whatsapp', 'WhatsApp'
        TELEGRAM = 'telegram', 'Telegram'
        MAX = 'max', 'MAX'
        EMAIL = 'email', 'Email'
        OTHER = 'other', 'Другое'

    name = models.CharField('Имя клиента', max_length=255)
    phone = models.CharField('Телефон', max_length=32)
    email = models.EmailField('Email', blank=True)
    preferred_messenger = models.CharField(
        'Приоритетный мессенджер / канал связи', max_length=20,
        choices=Messenger.choices, default=Messenger.PHONE,
    )
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.SITE_FORM)
    direction = models.ForeignKey(
        Direction, on_delete=models.SET_NULL, null=True, blank=True, related_name='leads',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    assigned_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='leads',
    )
    tags = models.ManyToManyField(LeadTag, blank=True, related_name='leads', verbose_name='Метки заявки')

    # Туристические параметры заявки. Все поля nullable/blank, чтобы миграция не меняла
    # и не перезаписывала уже существующие обращения и заявки.
    departure_city = models.CharField('Город вылета', max_length=100, blank=True)
    departure_date = models.DateField('Дата вылета', null=True, blank=True)
    nights = models.PositiveSmallIntegerField('Количество ночей', null=True, blank=True)
    adults = models.PositiveSmallIntegerField('Взрослых', null=True, blank=True)
    children_count = models.PositiveSmallIntegerField('Детей', null=True, blank=True)
    children_ages = models.CharField('Возраст детей', max_length=100, blank=True)
    budget_from = models.DecimalField('Бюджет от', max_digits=10, decimal_places=2, null=True, blank=True)
    budget_to = models.DecimalField('Бюджет до', max_digits=10, decimal_places=2, null=True, blank=True)
    meal_type = models.CharField('Питание', max_length=100, blank=True)
    hotel_wishes = models.TextField('Пожелания по отелю и отдыху', blank=True)
    next_contact_at = models.DateTimeField('Следующий контакт', null=True, blank=True)

    deal_amount = models.DecimalField('Сумма сделки', max_digits=10, decimal_places=2, null=True, blank=True)
    tour_currency = models.CharField('Валюта тура', max_length=10, choices=Currency.choices, default=Currency.RUB)
    payment_exchange_rate = models.DecimalField('Курс на момент оплаты', max_digits=12, decimal_places=4, null=True, blank=True)
    commission = models.DecimalField('Комиссия', max_digits=10, decimal_places=2, null=True, blank=True)
    prepayment_amount = models.DecimalField('Предоплата', max_digits=10, decimal_places=2, null=True, blank=True)
    paid_amount = models.DecimalField('Оплачено туристом', max_digits=10, decimal_places=2, null=True, blank=True)
    balance_due = models.DecimalField('Остаток к оплате', max_digits=10, decimal_places=2, null=True, blank=True)
    full_payment_due_at = models.DateTimeField('Дедлайн полной оплаты', null=True, blank=True)
    tour_operator = models.CharField('Туроператор (текст, старое поле)', max_length=100, blank=True)
    tour_operator_ref = models.ForeignKey(
        TourOperator, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='leads', verbose_name='Туроператор из справочника',
    )
    booking_number = models.CharField('Номер брони', max_length=100, blank=True)
    failure_reason = models.CharField('Причина отказа / нецелевой заявки', max_length=255, blank=True)

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


class LeadContact(models.Model):
    """Отдельный контакт клиента в заявке: телефоны, почта, мессенджеры.

    Нужен для истории коммуникаций и будущих email/мессенджер-рассылок.
    """

    class Type(models.TextChoices):
        PHONE = 'phone', 'Телефон'
        WHATSAPP = 'whatsapp', 'WhatsApp'
        TELEGRAM = 'telegram', 'Telegram'
        MAX = 'max', 'MAX'
        EMAIL = 'email', 'Email'
        OTHER = 'other', 'Другое'

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='contacts')
    type = models.CharField('Тип контакта', max_length=20, choices=Type.choices)
    value = models.CharField('Значение контакта', max_length=255)
    label = models.CharField('Комментарий / кому принадлежит', max_length=100, blank=True)
    is_primary = models.BooleanField('Основной контакт', default=False)
    allow_marketing = models.BooleanField('Можно использовать для рассылок', default=True)
    note = models.TextField('Примечание', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_primary', 'type', 'value']
        unique_together = ('lead', 'type', 'value')
        indexes = [
            models.Index(fields=['type', 'value']),
            models.Index(fields=['allow_marketing', 'type']),
        ]

    def __str__(self):
        return f'{self.get_type_display()}: {self.value}'


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
