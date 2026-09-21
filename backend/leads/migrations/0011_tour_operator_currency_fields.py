from django.db import migrations, models
import django.db.models.deletion


TOUR_OPERATORS = [
    {
        'brand_name': 'ANEX Tour',
        'website': 'https://www.anextour.com',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'Библио-Глобус',
        'website': 'https://www.bgoperator.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'Coral Travel',
        'website': 'https://www.coral.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'Sunmar',
        'website': 'https://www.sunmar.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'FUN&SUN',
        'website': 'https://fstravel.com',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'PEGAS Touristik',
        'website': 'https://pegast.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'Интурист',
        'website': 'https://intourist.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'PAC Group',
        'website': 'https://www.pac.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'Space Travel',
        'website': 'https://spacetour.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'ITM group',
        'website': 'https://itmgroup.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'Премьера',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'Ambotis Holidays',
        'website': 'https://ambotis.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'Resort Holiday',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'One Click Travel',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'One Touch & Travel',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'АЛЕАН',
        'website': 'https://www.alean.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'Мультитур',
        'website': 'https://www.multitour.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'Дельфин',
        'website': 'https://www.delfin-tour.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'Русский Экспресс',
        'website': 'https://www.r-express.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
    {
        'brand_name': 'ICS Travel Group',
        'website': 'https://www.icstrvl.ru',
        'note': 'Стартовая запись справочника. Реквизиты проверьте по договору и действующему реестру туроператоров.',
    },
]


def seed_tour_operators(apps, schema_editor):
    TourOperator = apps.get_model('leads', 'TourOperator')
    for data in TOUR_OPERATORS:
        defaults = {key: value for key, value in data.items() if key != 'brand_name'}
        TourOperator.objects.update_or_create(brand_name=data['brand_name'], defaults=defaults)


def unseed_tour_operators(apps, schema_editor):
    TourOperator = apps.get_model('leads', 'TourOperator')
    TourOperator.objects.filter(brand_name__in=[item['brand_name'] for item in TOUR_OPERATORS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0010_extend_lead_travel_sales_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='TourOperator',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('brand_name', models.CharField(max_length=120, unique=True, verbose_name='Бренд / название для выбора')),
                ('legal_name', models.CharField(blank=True, max_length=255, verbose_name='Юридическое наименование')),
                ('inn', models.CharField(blank=True, max_length=20, verbose_name='ИНН')),
                ('ogrn', models.CharField(blank=True, max_length=20, verbose_name='ОГРН')),
                ('registry_number', models.CharField(blank=True, max_length=64, verbose_name='Реестровый номер туроператора')),
                ('activity_scope', models.CharField(blank=True, max_length=255, verbose_name='Сфера деятельности')),
                ('website', models.URLField(blank=True, verbose_name='Сайт')),
                ('phone', models.CharField(blank=True, max_length=100, verbose_name='Телефон')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='Email')),
                ('address', models.TextField(blank=True, verbose_name='Юридический / почтовый адрес')),
                ('payment_details', models.TextField(blank=True, verbose_name='Реквизиты / договорные данные')),
                ('note', models.TextField(blank=True, verbose_name='Примечание')),
                ('is_active', models.BooleanField(default=True, verbose_name='Активен')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['brand_name'],
            },
        ),
        migrations.AddField(
            model_name='lead',
            name='tour_currency',
            field=models.CharField(choices=[('RUB', 'RUB — рубль'), ('USD', 'USD — доллар США'), ('EUR', 'EUR — евро'), ('CNY', 'CNY — юань'), ('AED', 'AED — дирхам ОАЭ'), ('THB', 'THB — бат'), ('TRY', 'TRY — турецкая лира'), ('OTHER', 'Другая валюта')], default='RUB', max_length=10, verbose_name='Валюта тура'),
        ),
        migrations.AddField(
            model_name='lead',
            name='payment_exchange_rate',
            field=models.DecimalField(blank=True, decimal_places=4, max_digits=12, null=True, verbose_name='Курс на момент оплаты'),
        ),
        migrations.AddField(
            model_name='lead',
            name='tour_operator_ref',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='leads', to='leads.touroperator', verbose_name='Туроператор из справочника'),
        ),
        migrations.RunPython(seed_tour_operators, unseed_tour_operators),
    ]
