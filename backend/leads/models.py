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
    """Справочник туроператоров для CRM: бренд, юридические данные, реестр и реквизиты."""

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
    """Курс валюты конкретного туроператора на дату."""

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
        indexes = [models.Index(fields=['operator', 'currency', 'rate_date'])]

    def __str__(self):
        return f'{self.operator} — {self.currency} {self.rate} на {self.rate_date}'


class Contact(models.Model):
    """Клиент / контактная карточка клиента.

    Это самостоятельная сущность: один клиент может иметь несколько заявок,
    а телефоны и email используются для последующих рассылок и сегментации.
    """

    class PreferredContactMethod(models.TextChoices):
        PHONE = 'phone', 'Телефон'
        WHATSAPP = 'whatsapp', 'WhatsApp'
        TELEGRAM = 'telegram', 'Telegram'
        MAX = 'max', 'MAX'
        VK = 'vk', 'ВК'
        EMAIL = 'email', 'Email'
        OTHER = 'other', 'Другое'

    last_name = models.CharField('Фамилия', max_length=120, blank=True)
    first_name = models.CharField('Имя', max_length=120, blank=True)
    middle_name = models.CharField('Отчество', max_length=120, blank=True)
    birth_date = models.DateField('Дата рождения', null=True, blank=True)
    email_primary = models.EmailField('Email основной', blank=True)
    email_secondary = models.EmailField('Email дополнительный', blank=True)
    phone_primary = models.CharField('Телефон основной', max_length=32, blank=True)
    phone_secondary = models.CharField('Телефон дополнительный', max_length=32, blank=True)
    vk_profile = models.CharField('ВК', max_length=255, blank=True)
    preferred_contact_method = models.CharField(
        'Предпочтительный тип связи',
        max_length=20,
        choices=PreferredContactMethod.choices,
        default=PreferredContactMethod.PHONE,
    )
    allow_email_marketing = models.BooleanField('Можно использовать email для рассылок', default=True)
    allow_messenger_marketing = models.BooleanField('Можно использовать мессенджеры для рассылок', default=True)
    note = models.TextField('Примечание', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['last_name', 'first_name', 'phone_primary']
        indexes = [
            models.Index(fields=['phone_primary']),
            models.Index(fields=['email_primary']),
            models.Index(fields=['preferred_contact_method']),
        ]

    @property
    def full_name(self):
        return ' '.join(part for part in [self.last_name, self.first_name, self.middle_name] if part).strip()

    def __str__(self):
        return self.full_name or self.phone_primary or self.email_primary or f'Контакт #{self.pk}'


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
        SITE_FORM = 'site_form', 'Сайт / форма'
        SLETAT = 'sletat', 'Слетать.ру'
        CHATBOT = 'chatbot', 'Чат-бот'
        PHONE_CALL = 'phone_call', 'Телефонный звонок'
        WHATSAPP = 'whatsapp', 'WhatsApp'
        TELEGRAM = 'telegram', 'Telegram'
        VK = 'vk', 'ВК'
        MAX = 'max', 'MAX'
        OFFICE = 'office', 'Офис / личное обращение'
        REFERRAL = 'referral', 'Рекомендация'
        REPEAT = 'repeat', 'Повторный клиент'
        INSTAGRAM = 'instagram', 'Instagram'
        UON = 'uon', 'U-ON'
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
        VK = 'vk', 'ВК'
        EMAIL = 'email', 'Email'
        OTHER = 'other', 'Другое'

    contact = models.ForeignKey(
        Contact, on_delete=models.SET_NULL, null=True, blank=True, related_name='leads', verbose_name='Клиент / контакт',
    )
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


class CommissionTier(models.Model):
    """Единая лестница уровней плана менеджера."""

    name = models.CharField('Название уровня', max_length=50, unique=True)
    threshold = models.DecimalField('Порог (своя комиссия за месяц)', max_digits=10, decimal_places=2, unique=True)
    commission_percent = models.DecimalField('% от своей комиссии на этом уровне', max_digits=5, decimal_places=2)

    class Meta:
        ordering = ['threshold']

    def __str__(self):
        return f'{self.name} (от {self.threshold} ₽ — {self.commission_percent}%)'


class MonthlyPlan(models.Model):
    """Параметры расчёта зарплаты менеджера за месяц."""

    manager = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='monthly_plans')
    year = models.PositiveSmallIntegerField('Год')
    month = models.PositiveSmallIntegerField('Месяц')
    base_salary = models.DecimalField('Оклад', max_digits=10, decimal_places=2, default=Decimal('30000'))
    bonus_percent = models.DecimalField('% от комиссии остальных (SLA/ежедневные задачи)', max_digits=5, decimal_places=2, default=Decimal('3'))

    class Meta:
        ordering = ['-year', '-month']
        unique_together = ('manager', 'year', 'month')

    def __str__(self):
        return f'{self.manager} — {self.month:02d}.{self.year}'


class WorkShift(models.Model):
    """Рабочий график менеджеров по дням."""

    date = models.DateField('Дата', unique=True)
    manager = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='work_shifts')

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f'{self.date}: {self.manager}'


class LeadComment(models.Model):
    """Лента комментариев менеджера по ходу работы с заявкой."""

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='lead_comments')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'Комментарий к заявке #{self.lead_id}'


class LeadStatusHistory(models.Model):
    """Аудит изменений статуса заявки."""

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='status_history')
    old_status = models.CharField(max_length=20, choices=Lead.Status.choices, blank=True)
    new_status = models.CharField(max_length=20, choices=Lead.Status.choices)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='lead_status_changes')
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['changed_at']
        verbose_name_plural = 'Lead status history'

    def __str__(self):
        return f'#{self.lead_id}: {self.old_status} → {self.new_status}'


class LeadAttachment(models.Model):
    """Прикреплённые файлы (документы, счета)."""

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='lead_attachments/%Y/%m/')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file.name
