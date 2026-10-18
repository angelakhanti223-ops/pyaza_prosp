# Где отдохнуть в марте

Подготовленный пост повторяет порядок и структуру январской статьи:
16 разделов, таблица на 7 направлений, выделенные советы, семейный и бюджетный
отдых, заявка и пять вопросов FAQ. Фото и подписи всех четырёх слайдов другие.
Содержание адаптировано к марту, 8 Марта и весенним каникулам без фиксированных
цен, гарантий погоды и привязки к конкретному году.

- URL: `/blog/gde-otdohnut-v-marte`
- Заголовок: Где отдохнуть в марте: море, тепло, экскурсии и лучшие направления для отпуска
- SEO title: Где отдохнуть в марте: море, тепло и отдых с детьми
- SEO description: Куда поехать отдыхать в марте: тёплое море, Египет, ОАЭ, Таиланд, Вьетнам, Мальдивы, Шри-Ланка и Россия. Советы для отдыха с детьми и выбора тура.
- Категория: Советы туристам
- Статус после миграций `0015` и `0016`: **опубликовано**, с текущей датой публикации.

## Публикация

По запросу владельца добавлена миграция `articles.0016`: она публикует мартовский
пост, сохраняя его текст и редакторские правки. Уже установленная прошедшая дата
публикации сохраняется; будущая дата заменяется текущей для немедленной публикации.
Откат миграции контент не удаляет.

Команды на существующем сервере:

```bash
cd /opt/sletat
git pull --ff-only origin master
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate
```

Для новых слайдов нужна сборка frontend. После выкладки проверить страницу
`/blog/gde-otdohnut-v-marte`, все четыре фото и появление поста в блоге.
Слияние PR само по себе сервер не обновляет.

## Фото

Файлы `frontend/public/blog/march/*.jpg`, каждый 1280 × 720.

| Файл | Сюжет | Источник |
| --- | --- | --- |
| island.jpg | Островная лагуна и виллы | https://images.unsplash.com/photo-1540202404-a2f29016b523 |
| egypt.jpg | Пирамиды и караван | https://images.unsplash.com/photo-1539768942893-daf53e448371 |
| vietnam.jpg | Бухта Халонг | https://images.unsplash.com/photo-1528127269322-539801943592 |
| family.jpg | Бассейн, пальмы и пляж | https://images.unsplash.com/photo-1546708973-b339540b5162 |

Семейный слайд иллюстрирует формат отеля, не обещает конкретный объект или страну.
Фото Халонга сопровождается пояснением о более прохладной погоде на севере Вьетнама.
Фотографии отличаются от январской и февральской каруселей.

## Источники для редакторской проверки

- Вьетнам: https://vietnam.travel/things-to-do/weather-and-climate-vietnam/
- Таиланд: https://www.tatnews.org/2024/02/the-best-time-to-visit-thailands-beaches-and-islands/
- Мальдивы: https://visitmaldives.com/en/experience/for-pluviophiles-and-the-love-of-petrichor
- Шри-Ланка: https://srilanka.travel/pristine-beach-holidays
- Египет: https://www.experienceegypt.eg/en/home/faq
- Дубай: https://www.visitdubai.com/en/articles/dubai-in-march-weather-guide
- Доминикана: https://www.godominicanrepublic.com/travel/travel-tips

Перед бронированием проверяются актуальные условия перелёта и въезда,
расписание объектов и работа инфраструктуры конкретного отеля.
