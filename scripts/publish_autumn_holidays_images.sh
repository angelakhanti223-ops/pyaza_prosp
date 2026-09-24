#!/usr/bin/env bash
set -euo pipefail

ZIP_PATH="${1:-/opt/sletat/autumn_holidays_article_images.zip}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SERVICE="${SERVICE:-backend}"
CONTAINER_ZIP="/tmp/autumn_holidays_article_images.zip"

if [ ! -f "$ZIP_PATH" ]; then
  echo "Не найден архив: $ZIP_PATH"
  echo "Положи autumn_holidays_article_images.zip в /opt/sletat или передай путь первым аргументом."
  exit 1
fi

CONTAINER_ID="$(docker compose -f "$COMPOSE_FILE" ps -q "$SERVICE")"
if [ -z "$CONTAINER_ID" ]; then
  echo "Не найден контейнер backend. Запусти: docker compose -f $COMPOSE_FILE up -d backend"
  exit 1
fi

docker cp "$ZIP_PATH" "$CONTAINER_ID:$CONTAINER_ZIP"

docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" python manage.py shell <<'PY'
from pathlib import Path
from zipfile import ZipFile

from django.conf import settings
from articles.models import Article

ARTICLE_SLUG = "gde-otdohnut-na-osennih-kanikulah"
ZIP_PATH = Path("/tmp/autumn_holidays_article_images.zip")
TARGET_DIR = Path(settings.MEDIA_ROOT) / "articles" / "autumn-holidays"

# Канонические имена, если архив скачан с исходными русскими названиями.
CANONICAL_SOURCES = [
    "семья_на_закате_у_моря.png",
    "семейный_отдых_на_лазурном_берегу.png",
    "золотой_час_над_босфором.png",
    "осенний_курорт_с_видом_на_горы.png",
    "семейная_прогулка_у_золотого_собора.png",
]

TARGETS = [
    ("cover.png", "Семейный отдых на осенних каникулах у моря", "Осенние каникулы можно провести у моря, в городе или в горах — главное подобрать формат под семью."),
    ("beach.png", "Пляжный семейный отдых на осенних каникулах", "Пляжные направления на осенние каникулы чаще выбирают ради all inclusive, тёплого моря и детской инфраструктуры."),
    ("istanbul.png", "Осенний Стамбул для семейной поездки", "Стамбул подходит для осенних каникул, если хочется прогулок, Босфора, гастрономии и насыщенной экскурсионной программы."),
    ("mountains.png", "Горы и SPA на осенних каникулах", "Горные курорты и SPA-отели — спокойный вариант для семей, которые не хотят дальнего перелёта."),
    ("city.png", "Экскурсионные каникулы в красивом городе", "Городские поездки по России удобны для школьников: музеи, архитектура, прогулки и короткая дорога."),
]

FIGURES = {
    "cover": ("/media/articles/autumn-holidays/cover.png", TARGETS[0][1], TARGETS[0][2]),
    "beach": ("/media/articles/autumn-holidays/beach.png", TARGETS[1][1], TARGETS[1][2]),
    "istanbul": ("/media/articles/autumn-holidays/istanbul.png", TARGETS[2][1], TARGETS[2][2]),
    "mountains": ("/media/articles/autumn-holidays/mountains.png", TARGETS[3][1], TARGETS[3][2]),
    "city": ("/media/articles/autumn-holidays/city.png", TARGETS[4][1], TARGETS[4][2]),
}


def figure_html(key):
    src, alt, caption = FIGURES[key]
    return (
        f'\n<figure style="margin:28px 0;">'
        f'<img src="{src}" alt="{alt}" loading="lazy" '
        f'style="width:100%;height:auto;border-radius:24px;display:block;box-shadow:0 18px 45px rgba(16,45,95,.12);" />'
        f'<figcaption style="margin-top:8px;color:#6b7280;font-size:14px;line-height:1.5;">{caption}</figcaption>'
        f'</figure>\n'
    )


def add_once(content, marker, html, before=False):
    if html.strip() in content:
        return content
    if marker not in content:
        print(f"Маркер не найден: {marker}")
        return content
    if before:
        return content.replace(marker, html + marker, 1)
    return content.replace(marker, marker + html, 1)

article = Article.objects.filter(slug=ARTICLE_SLUG).first()
if not article:
    raise SystemExit(f"Статья не найдена: {ARTICLE_SLUG}")
if not ZIP_PATH.exists():
    raise SystemExit(f"Архив не найден внутри контейнера: {ZIP_PATH}")

TARGET_DIR.mkdir(parents=True, exist_ok=True)
with ZipFile(ZIP_PATH) as archive:
    names = archive.namelist()
    image_names = [name for name in names if name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")) and not name.endswith("/")]
    print("Файлы в архиве:")
    for name in names:
        print(" -", name)

    canonical_ok = all(name in names for name in CANONICAL_SOURCES)
    if canonical_ok:
        selected = CANONICAL_SOURCES
    else:
        if len(image_names) < 5:
            raise SystemExit("В архиве найдено меньше 5 изображений. Найдено: " + ", ".join(image_names))
        selected = image_names[:5]
        print("Русские имена не найдены, использую первые 5 изображений из архива по порядку:")
        for name in selected:
            print(" *", name)

    for source_name, (target_name, _alt, _caption) in zip(selected, TARGETS):
        target = TARGET_DIR / target_name
        target.write_bytes(archive.read(source_name))
        print("saved", target)

content = article.content or ""
content = add_once(content, "</section>", figure_html("cover"), before=False)
content = add_once(content, "<h2>Египет на осенние каникулы</h2>", figure_html("beach"), before=True)
content = add_once(content, "<h2>Турция на осенние каникулы</h2>", figure_html("istanbul"), before=True)
content = add_once(content, "<h2>Сочи и Красная Поляна</h2>", figure_html("mountains"), before=True)
content = add_once(content, "<h2>Санкт-Петербург на осенние каникулы</h2>", figure_html("city"), before=True)

article.content = content
article.featured_image = "articles/autumn-holidays/cover.png"
article.save(update_fields=["content", "featured_image", "updated_at"])

print("OK article_id=", article.id)
print("URL=/blog/" + article.slug)
PY

docker compose -f "$COMPOSE_FILE" restart backend frontend caddy

echo "Готово: https://flypenza.ru/blog/gde-otdohnut-na-osennih-kanikulah"
