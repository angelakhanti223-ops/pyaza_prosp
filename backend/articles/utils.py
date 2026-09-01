from django.utils.text import slugify

# Django admin's prepopulated_fields transliterates Cyrillic client-side (urlify.js);
# this CRM form is a separate React page with no such JS, and Article.slug is a plain
# ASCII SlugField (no allow_unicode=True), so django's own slugify() on a Russian title
# would strip every Cyrillic letter and often return an empty string. Practical
# transliteration table instead of adding a pip dependency for one small helper.
_CYRILLIC_TO_LATIN = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya',
}


def transliterate(text: str) -> str:
    result = []
    for char in text:
        lower = char.lower()
        if lower in _CYRILLIC_TO_LATIN:
            replacement = _CYRILLIC_TO_LATIN[lower]
            result.append(replacement.capitalize() if char.isupper() and replacement else replacement)
        else:
            result.append(char)
    return ''.join(result)


def unique_slug(model, title: str, *, exclude_pk=None) -> str:
    """Генерирует ASCII-слаг из (возможно кириллического) заголовка и гарантирует
    уникальность в пределах модели — добавляя -2, -3, ... при коллизии."""
    base = slugify(transliterate(title)) or 'article'
    slug = base
    qs = model.objects.all()
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)

    suffix = 2
    while qs.filter(slug=slug).exists():
        slug = f'{base}-{suffix}'
        suffix += 1
    return slug
