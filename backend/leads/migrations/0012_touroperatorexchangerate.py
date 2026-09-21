from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0011_tour_operator_currency_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='TourOperatorExchangeRate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('currency', models.CharField(choices=[('RUB', 'RUB — рубль'), ('USD', 'USD — доллар США'), ('EUR', 'EUR — евро'), ('CNY', 'CNY — юань'), ('AED', 'AED — дирхам ОАЭ'), ('THB', 'THB — бат'), ('TRY', 'TRY — турецкая лира'), ('OTHER', 'Другая валюта')], max_length=10, verbose_name='Валюта')),
                ('rate', models.DecimalField(decimal_places=4, max_digits=12, verbose_name='Курс туроператора')),
                ('rate_date', models.DateField(verbose_name='Дата курса')),
                ('source_url', models.URLField(blank=True, verbose_name='Ссылка на источник курса')),
                ('source_note', models.CharField(blank=True, max_length=255, verbose_name='Комментарий / источник курса')),
                ('is_active', models.BooleanField(default=True, verbose_name='Активен')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('operator', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='exchange_rates', to='leads.touroperator', verbose_name='Туроператор')),
            ],
            options={
                'ordering': ['operator__brand_name', 'currency', '-rate_date'],
                'unique_together': {('operator', 'currency', 'rate_date')},
            },
        ),
        migrations.AddIndex(
            model_name='touroperatorexchangerate',
            index=models.Index(fields=['operator', 'currency', 'rate_date'], name='leads_touro_operato_9654b0_idx'),
        ),
    ]
