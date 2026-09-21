import html
import logging
import os
import re
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from typing import Iterable
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.utils import timezone

from .models import TourOperator, TourOperatorExchangeRate

logger = logging.getLogger('leads')

PUBLIC_RATES_URL = 'https://tour-kurs.ru/'
PUBLIC_RATE_SOURCE_NOTE = 'ТурКурс: курсы валют туроператоров'
UON_RATE_SOURCE_NOTE = 'U-ON: Финансы → Курсы валют → Курсы валют ТО'
DEFAULT_RATES_PATH = '/currency_rates_operators.php'

OPERATOR_ALIASES = [
    {'anex', 'anex tour', 'anextour', 'анекс', 'анекс тур'},
    {'biblio globus', 'biblioglobus', 'bgoperator', 'библио глобус', 'библиоглобус'},
    {'coral', 'coral travel', 'корал', 'корал тревел'},
    {'sunmar', 'санмар'},
    {'fun sun', 'fun&sun', 'fun and sun', 'фан сан', 'фан энд сан'},
    {'pegas', 'pegas touristic', 'pegast', 'пегас', 'пегас туристик'},
    {'intourist', 'интурист'},
    {'pac', 'paks', 'пак', 'пакс'},
    {'space travel', 'space', 'спейс', 'спейс тревел'},
    {'itm', 'итм'},
    {'premiera', 'premier', 'премьера'},
    {'ambotis', 'амботис'},
    {'resort holiday', 'resort', 'резорт', 'резорт холидэй'},
    {'one click', 'oneclick', 'one clik', 'ван клик'},
    {'one touch', 'onetouch', 'ван тач'},
    {'russian express', 'русский экспресс'},
    {'tez tour', 'tez', 'тез тур'},
    {'amigo', 'амиго'},
    {'bon tour', 'bontour', 'бон тур', 'бонтур'},
    {'art tour', 'арт тур'},
    {'art travel', 'арт тревел'},
    {'china travel', 'чайна тревел'},
    {'ics', 'ics travel', 'икс', 'икс тревел'},
    {'loti', 'лоти'},
    {'europort', 'европорт'},
    {'kazunion', 'казюнион'},
]

CURRENCIES = {
    'USD': ('usd', '$', 'доллар', 'доллар сша'),
    'EUR': ('eur', '€', 'евро'),
}

# Только десятичные значения. Так мы не берём служебные числа/номера со страницы
# как курс. Ошибка 47.0000 возникла именно из-за слишком свободного regex,
# который принимал любое 2-3 значное число.
RATE_RE = re.compile(r'(?<!\d)(\d{2,3}[,.]\d{1,4})(?!\d)')

UI_TEXT_BLACKLIST = {
    'название', 'курс usd', 'курс eur', 'курсы валют туроператоров', 'курсы туроператоров',
    'сегодня', 'очистить', 'добавить', 'финансы', 'кассы', 'кассовая книга', 'фискальные чеки',
    'обращения', 'заявки', 'туристы', 'партнеры', 'интеграции', 'настройки', 'личный кабинет туриста',
    'главная', 'о нас', 'новости', 'поиск туров', 'горящие', 'календарь туров', 'страны',
    'билеты', 'страховки', 'топ направлений', 'принять все', 'политика обработки персональных данных',
    'сравнение курсов', 'архив', 'калькулятор', 'частые вопросы', 'отображение валют', 'только доллар',
    'только евро', 'изменение', 'разница с цб',
}


class _TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'tr':
            self._row = []
        elif tag in ('td', 'th') and self._row is not None:
            self._cell = []
        elif tag in ('input', 'option') and self._cell is not None:
            value = attrs_dict.get('value') or attrs_dict.get('data-value') or ''
            if value:
                self._cell.append(str(value))

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self._row is not None and self._cell is not None:
            self._row.append(_clean_cell(' '.join(self._cell)))
            self._cell = None
        elif tag == 'tr' and self._row is not None:
            row = [cell for cell in self._row if cell]
            if row:
                self.rows.append(row)
            self._row = None
            self._cell = None


def _clean_cell(value: str) -> str:
    value = html.unescape(value or '')
    value = re.sub(r'\s+', ' ', value).strip()
    return value


def _norm(value: str) -> str:
    value = (value or '').lower().replace('ё', 'е')
    value = value.replace('&', ' and ')
    value = re.sub(r'[^a-zа-я0-9]+', ' ', value)
    return re.sub(r'\s+', ' ', value).strip()


def _compact(value: str) -> str:
    return _norm(value).replace(' ', '')


def _currency_from_text(value: str) -> str | None:
    text = _norm(value)
    raw = (value or '').lower()
    for code, markers in CURRENCIES.items():
        if any(marker in text or marker in raw for marker in markers):
            return code
    return None


def _valid_rate(currency: str, rate: Decimal) -> bool:
    # Защитный диапазон для курса ТО к рублю. Значения ниже 60 для USD/EUR сейчас
    # почти наверняка не курс туроператора, а служебное число из HTML.
    if currency == 'USD':
        return Decimal('60') <= rate <= Decimal('160')
    if currency == 'EUR':
        return Decimal('60') <= rate <= Decimal('180')
    return Decimal('1') <= rate <= Decimal('300')


def _all_rates_from_text(value: str) -> list[Decimal]:
    rates: list[Decimal] = []
    text = (value or '').replace('\xa0', ' ')
    for match in RATE_RE.finditer(text):
        raw = match.group(1).replace(',', '.')
        try:
            rate = Decimal(raw).quantize(Decimal('0.0001'))
        except InvalidOperation:
            continue
        rates.append(rate)
    return rates


def _rate_from_text(value: str, currency: str | None = None) -> Decimal | None:
    for rate in _all_rates_from_text(value):
        if currency is None:
            if _valid_rate('USD', rate) or _valid_rate('EUR', rate):
                return rate
        elif _valid_rate(currency, rate):
            return rate
    return None


def _parse_rows(html_text: str) -> list[list[str]]:
    parser = _TableParser()
    parser.feed(html_text)
    return parser.rows


def _rates_from_cells(cells: list[str]) -> dict[str, Decimal]:
    rates: dict[str, Decimal] = {}

    for cell in cells:
        currency = _currency_from_text(cell)
        if currency:
            rate = _rate_from_text(cell, currency)
            if rate is not None:
                rates[currency] = rate

    if rates:
        return rates

    numeric_rates: list[Decimal] = []
    for cell in cells:
        # Берём только явные денежные значения, чтобы не схватить даты, номера,
        # изменения к ЦБ или другие служебные цифры.
        lowered = cell.lower()
        if not any(marker in lowered for marker in ('₽', 'руб', 'р.')) and not re.search(r'\d+[,.]\d+', cell):
            continue
        numeric_rates.extend(_all_rates_from_text(cell))
        if len(numeric_rates) >= 2:
            break

    if numeric_rates and _valid_rate('USD', numeric_rates[0]):
        rates['USD'] = numeric_rates[0]
    if len(numeric_rates) > 1 and _valid_rate('EUR', numeric_rates[1]):
        rates['EUR'] = numeric_rates[1]
    return rates


def _extract_rates_from_tables(html_text: str) -> list[dict]:
    rows = _parse_rows(html_text)
    parsed: list[dict] = []
    header_currency_columns: dict[int, str] = {}

    for index, row in enumerate(rows):
        if not row:
            continue

        row_currencies = {idx: code for idx, cell in enumerate(row) if (code := _currency_from_text(cell))}
        if row_currencies and not _looks_like_operator_name(row[0]):
            header_currency_columns = row_currencies
            continue

        operator_name = row[0]
        if not _looks_like_operator_name(operator_name):
            continue

        rates: dict[str, Decimal] = {}
        if header_currency_columns:
            for col_idx, currency in header_currency_columns.items():
                if col_idx < len(row):
                    rate = _rate_from_text(row[col_idx], currency)
                    if rate is not None:
                        rates[currency] = rate

        if not rates:
            rates = _rates_from_cells(row[1:])

        if rates:
            parsed.append({'operator_name': operator_name, 'rates': rates, 'row_index': index})

    return parsed


def _html_to_lines(html_text: str) -> list[str]:
    text = re.sub(r'(?is)<script\b.*?</script>', '\n', html_text)
    text = re.sub(r'(?is)<style\b.*?</style>', '\n', text)
    text = re.sub(r'(?i)<\s*(tr|td|th|div|li|br|p|span|label|h\d|strong|b|section|article)\b[^>]*>', '\n', text)
    text = re.sub(r'(?i)</\s*(tr|td|th|div|li|p|span|label|h\d|strong|b|section|article)\s*>', '\n', text)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = html.unescape(text)
    lines = [_clean_cell(line) for line in text.splitlines()]
    return [line for line in lines if line]


def _looks_like_operator_name(value: str) -> bool:
    text = _clean_cell(value)
    norm = _norm(text)
    if not norm or norm in UI_TEXT_BLACKLIST:
        return False
    if '@' in text:
        return False
    if _rate_from_text(text) is not None:
        return False
    if len(text) < 3 or len(text) > 120:
        return False
    if re.search(r'\b(currency|cookie|script|function|return|window|document|copyright|utm|telegram)\b', text, re.I):
        return False
    if '/' in text:
        return True
    compact = _compact(text)
    return any(_compact(alias) and _compact(alias) in compact for group in OPERATOR_ALIASES for alias in group)


def _extract_rates_from_text(html_text: str) -> list[dict]:
    lines = _html_to_lines(html_text)
    parsed: list[dict] = []

    for idx, line in enumerate(lines):
        if not _looks_like_operator_name(line):
            continue

        # Tour-kurs может отдавать название, домен, доллар, евро разными div-ами.
        next_lines: list[str] = []
        for next_line in lines[idx + 1: idx + 10]:
            if _looks_like_operator_name(next_line):
                break
            next_lines.append(next_line)

        rates = _rates_from_cells(next_lines)
        if rates:
            parsed.append({'operator_name': line, 'rates': rates, 'row_index': idx})

    unique: dict[str, dict] = {}
    for item in parsed:
        key = _compact(item['operator_name'])
        unique[key] = item
    return list(unique.values())


def _extract_rates(html_text: str) -> list[dict]:
    # Преднамеренно не используем сканирование произвольного JS/JSON вокруг алиасов:
    # оно может принять служебные цифры за курс. Берём только табличную или явно
    # текстовую структуру страницы.
    for extractor in (_extract_rates_from_tables, _extract_rates_from_text):
        rates = extractor(html_text)
        if rates:
            return rates
    return []


def _operator_aliases(operator: TourOperator) -> set[str]:
    values = {operator.brand_name, operator.legal_name, operator.inn, operator.registry_number}
    normalized = {_norm(value) for value in values if value}
    compacted = {_compact(value) for value in values if value}

    all_aliases = normalized | compacted
    operator_blob = ' '.join(all_aliases)
    for group in OPERATOR_ALIASES:
        group_norm = {_norm(item) for item in group}
        group_compact = {_compact(item) for item in group}
        if any(alias and (alias in operator_blob or _compact(alias) in operator_blob) for alias in group_norm | group_compact):
            all_aliases |= group_norm | group_compact
    return {alias for alias in all_aliases if alias}


def _match_operator(source_name: str, operators: Iterable[TourOperator]) -> TourOperator | None:
    source_norm = _norm(source_name)
    source_compact = _compact(source_name)
    if not source_norm:
        return None

    best: tuple[int, TourOperator] | None = None
    for operator in operators:
        aliases = _operator_aliases(operator)
        score = 0
        for alias in aliases:
            alias_compact = _compact(alias)
            if source_norm == alias or source_compact == alias_compact:
                score = max(score, 100)
            elif alias and (alias in source_norm or source_norm in alias):
                score = max(score, 80)
            elif alias_compact and (alias_compact in source_compact or source_compact in alias_compact):
                score = max(score, 75)
            else:
                source_tokens = set(source_norm.split())
                alias_tokens = set(alias.split())
                if source_tokens and alias_tokens:
                    overlap = len(source_tokens & alias_tokens) / max(len(source_tokens), len(alias_tokens))
                    if overlap >= 0.6:
                        score = max(score, 60)
        if score and (best is None or score > best[0]):
            best = (score, operator)

    return best[1] if best and best[0] >= 60 else None


def _login_page_detected(url: str, html_text: str) -> bool:
    host = urlparse(url).netloc.lower()
    if 'u-on.ru' not in host:
        return False
    text = _norm(html_text[:5000])
    markers = ('войти', 'логин', 'пароль', 'login', 'password', 'authorization')
    return any(marker in text for marker in markers)


def _rates_url() -> str:
    public_url = os.getenv('TOUR_OPERATOR_RATES_URL', '').strip()
    if public_url:
        return public_url

    configured = os.getenv('UON_OPERATOR_RATES_URL', '').strip()
    if configured and 'u-on.ru' not in urlparse(configured).netloc.lower():
        return configured

    return PUBLIC_RATES_URL


def _request_headers(url: str | None = None) -> dict[str, str]:
    url = url or _rates_url()
    host = urlparse(url).netloc.lower()
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                      '(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }

    if 'u-on.ru' in host:
        headers['Referer'] = getattr(settings, 'UON_CABINET_URL', 'https://id62499.u-on.ru').rstrip('/') + '/'
        cookie = os.getenv('UON_CABINET_COOKIE', '').strip()
        if cookie:
            headers['Cookie'] = cookie
    else:
        headers['Referer'] = 'https://tour-kurs.ru/'

    return headers


def _source_note_for_url(url: str) -> str:
    return UON_RATE_SOURCE_NOTE if 'u-on.ru' in urlparse(url).netloc.lower() else PUBLIC_RATE_SOURCE_NOTE


def sync_operator_exchange_rates_from_uon() -> dict:
    url = _rates_url()
    today = timezone.localdate()

    enabled = os.getenv('UON_OPERATOR_RATE_SYNC_ENABLED', 'true').lower() not in {'0', 'false', 'no', 'off'}
    if not enabled:
        return {'status': 'skipped', 'reason': 'disabled'}

    try:
        response = requests.get(url, headers=_request_headers(url), timeout=30)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(f'Не удалось получить страницу курсов туроператоров: {exc}') from exc

    html_text = response.text
    if _login_page_detected(url, html_text):
        raise RuntimeError(
            'U-ON вернул страницу авторизации. Для публичной загрузки укажите TOUR_OPERATOR_RATES_URL=https://tour-kurs.ru/.'
        )

    extracted = _extract_rates(html_text)
    if not extracted:
        sample_path = '/tmp/operator_rates_last_response.html'
        try:
            with open(sample_path, 'w', encoding='utf-8') as file:
                file.write(html_text)
        except OSError:
            sample_path = ''
        detail = f' Сохранён ответ: {sample_path}' if sample_path else ''
        raise RuntimeError('На странице не удалось распознать таблицу курсов операторов.' + detail)

    operators = list(TourOperator.objects.filter(is_active=True))
    created = 0
    updated = 0
    skipped = []
    source_note = _source_note_for_url(url)

    for item in extracted:
        operator = _match_operator(item['operator_name'], operators)
        if operator is None:
            skipped.append(item['operator_name'])
            continue
        for currency, rate in item['rates'].items():
            if not _valid_rate(currency, rate):
                skipped.append(f"{item['operator_name']} {currency}={rate}")
                continue
            obj, was_created = TourOperatorExchangeRate.objects.update_or_create(
                operator=operator,
                currency=currency,
                rate_date=today,
                defaults={
                    'rate': rate,
                    'source_url': url,
                    'source_note': source_note,
                    'is_active': True,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

    return {
        'status': 'ok',
        'source': source_note,
        'date': today.isoformat(),
        'created': created,
        'updated': updated,
        'parsed_rows': len(extracted),
        'unmatched_operators': skipped[:50],
        'unmatched_count': len(skipped),
    }
