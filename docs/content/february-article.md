# Где отдохнуть в феврале

Подготовленный пост повторяет порядок и HTML-структуру январской статьи
`gde-otdohnut-v-yanvare`: 16 разделов, таблица с семью направлениями,
тематические выделения, семейный и бюджетный отдых, заявка и пять вопросов FAQ.
Карусель содержит четыре других изображения и новые подписи.

- URL: `/blog/gde-otdohnut-v-fevrale`
- Заголовок: Где отдохнуть в феврале: море, тепло, экскурсии и лучшие направления для отпуска
- SEO title: Где отдохнуть в феврале: море, тепло и отдых с детьми
- SEO description: Куда поехать отдыхать в феврале: тёплое море, Египет, ОАЭ, Таиланд, Вьетнам, Мальдивы, Шри-Ланка и Россия. Советы для отдыха с детьми и выбора тура.
- Категория: Советы туристам
- Статус после миграций `0013` и `0014`: **опубликовано**, с текущей датой публикации.

## Публикация

1. Развернуть изменения фронтенда и бэкенда обычным способом.
2. Выполнить `python manage.py migrate`: миграция `articles.0013` создаст черновик,
   а `articles.0014` опубликует его по запросу владельца сайта.
3. Проверить `/blog/gde-otdohnut-v-fevrale`, все четыре слайда и появление статьи в блоге.

Команды на существующем сервере:

```bash
cd /opt/sletat
git pull --ff-only origin master
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate
```

Для этой статьи нужна сборка фронтенда: в него добавлены отдельная февральская
карусель и новые локальные фотографии.

Повторный запуск функции наполнения сохраняет уже существующую статью и правки
редактора. Откат миграции не удаляет контент. Январский пост не меняется.

## Изображения

Файлы лежат в `frontend/public/blog/february/`, размер каждого — 1280 × 720.
Использованы другие фотографии Unsplash, отличные от январской карусели.
Горный пейзаж иллюстрирует формат отдыха и не обозначает конкретный российский курорт.

| Файл | Источник |
| --- | --- |
| thailand.jpg | https://images.unsplash.com/photo-1552465011-b4e21bf6e79a |
| dubai.jpg | https://images.unsplash.com/photo-1512453979798-5ea266f8880c |
| maldives.jpg | https://images.unsplash.com/photo-1514282401047-d79a71a590e8 |
| mountains.jpg | https://images.unsplash.com/photo-1454496522488-7a8e488e8606 |

## Редакторская проверка сезонности

Официальные туристические источники использованы для общих сезонных рекомендаций;
в тексте нет обещаний погоды, фиксированных цен, конкретных рейсов или неизменных
правил въезда.

- Таиланд: https://www.tatnews.org/2024/02/the-best-time-to-visit-thailands-beaches-and-islands/
- Вьетнам: https://vietnam.travel/things-to-do/weather-and-climate-vietnam
- Мальдивы: https://visitmaldives.com/en/experience/for-pluviophiles-and-the-love-of-petrichor
- Шри-Ланка: https://srilanka.travel/pristine-beach-holidays
- Египет: https://www.experienceegypt.eg/en/home/faq
- Дубай: https://www.visitdubai.com/en/articles/dubai-in-february-weather-guide
- Доминикана: https://www.godominicanrepublic.com/travel/travel-tips

## Проверки

- HTML: порядок блочных элементов совпадает с январским постом.
- Django 6: вся цепочка миграций статей применяется к SQLite; новый пост остаётся
  черновиком; повторное наполнение сохраняет редакторские изменения.
- Отдельная миграция публикации меняет только статус и дату февральского поста,
  сохраняя его текст, остальные статьи и уже установленную дату публикации.
- TypeScript: `npx tsc --noEmit`.
- ESLint изменённой страницы: `npx eslint 'src/app/(site)/blog/[slug]/page.tsx'`.
