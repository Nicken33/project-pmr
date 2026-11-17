# Жалобы, отзывы и вложения: контракт backend

Изменения относятся к Go backend и PostgreSQL. Интерфейс сайта этой задачей не изменяется.

## Установка

Примените `database/migrations/005_reports_review_media.sql` в рабочей базе **до запуска нового backend**. Новый поиск карточек читает `media.is_hidden`, поэтому старую схему оставлять нельзя. Миграция добавляет таблицу `reports`, поля `reviews.hidden_reason`, `media.review_id`, `media.is_hidden`, `media.source_url`, `media.license` и индексы. Она не удаляет существующие отзывы и фотографии. Повторный запуск поддерживается на той же совместимой схеме.

На VPS, из корня развёрнутого проекта, если SQL-файл уже перенесён туда:

```bash
docker exec -i talentro-db-1 psql -U talentro -d talentro -v ON_ERROR_STOP=1 < database/migrations/005_reports_review_media.sql
```

Затем пересоберите и перезапустите API обычным способом. Данная работа не выполняет развёртывание на VPS.

## Отзывы

Публичный список: `GET /api/v1/activities/{activityID}/reviews?page=1&limit=20`.
Создание: `POST /api/v1/activities/{activityID}/reviews`, Bearer-токен любого незаблокированного пользователя.

```json
{"text":"Мой отзыв о занятии"}
```

Текст: от 1 до 600 символов после удаления пробелов по краям. Ответ `201`: `id`, `activity_id`, `author_id` (ID — JSON-строки), `author_name`, `text`, `created_at`, `photos`, `videos`.

На одну секцию допускается по одному отзыву **от каждого пользователя**, а не один отзыв на всю секцию. Разные аккаунты могут иметь одинаковые отображаемые имена: backend различает их по `users.id`. Повтор от того же аккаунта — `409 review_exists`. Отзыв на собственную секцию, включая владение через организацию, — `403 own_review_forbidden`. На неопубликованную/неактивную секцию — `404 not_found`.

Для списка возвращается `{items,total,page,limit}`. Скрытые отзывы исключены и из items, и из total. Список имеет пагинацию: не считайте одну страницу полным списком.

## Медиа отзывов

Сначала создайте отзыв и получите его ID. Затем загрузите каждый файл отдельно:

- `POST /api/v1/reviews/{reviewID}/photos`
- `POST /api/v1/reviews/{reviewID}/videos`
- `DELETE /api/v1/reviews/{reviewID}/media/{mediaID}`

Требуется Bearer-токен **автора отзыва**. Роль владельца секции не даёт доступа к чужому отзыву. Файл — multipart-поле `file`, необязательная подпись `caption` до 255 символов. Content-Type с boundary выставляет curl/FormData.

Фото: JPG, PNG, WebP, до 10 МиБ; максимум пять на отзыв. Видео: MP4 до 50 МиБ, H.264 и AAC (либо без аудио), до 30 секунд; максимум одно на отзыв. Для видео в runtime нужен ffprobe. Скрытые модератором вложения также занимают лимит, пока автор их не удалит. Лимит загрузок — 30 попыток в час на пользователя.

Ответ загрузки `201`:

```json
{"id":"21","path":"reviews/8/random-name.jpg","media_type":"photo","position":0}
```

В базу записывается путь, а файл сохраняется под `MEDIA_DIR/reviews/{reviewID}/`. Ссылка для получения: `{BACKEND_BASE}/media/{path}`. JSON не содержит байты файла. При ошибке привязки новый файл удаляется. Удаление возвращает `204`, запись удаляется и физический файл убирается; ошибка очистки диска записывается в серверный лог.

Список вложений отдаётся вместе с публичными отзывами:

```json
{
  "items":[{
    "id":"8","activity_id":"12","author_id":"6","author_name":"Иван",
    "text":"Мой отзыв", "created_at":"2026-11-17T12:00:00Z",
    "photos":[{"id":"21","path":"reviews/8/random-name.jpg","position":0,"is_cover":false}],
    "videos":[{"id":"22","path":"reviews/8/random-name.mp4","position":1}]
  }],
  "total":1,"page":1,"limit":20
}
```

## Отправка жалобы

`POST /api/v1/reports`, Bearer-токен зарегистрированного незаблокированного пользователя:

```json
{
  "target_type":"review",
  "target_id":"8",
  "reason":"Оскорбления",
  "detail":"Пояснение для модератора"
}
```

Типы: `card` — секция/услуга, `review` — отзыв, `media` — фото/видео. Для `card` передаётся ID из `activities`, для `review` — из `reviews`, для `media` — ID из `media`. Значение `activity` принимается как синоним `card`. ID в теле — JSON-строка с положительным числом. Причина обязательна, 1–120 символов. `detail` необязателен, максимум 2000 символов. Данные об объекте, авторе жалобы и секции backend находит самостоятельно: не нужно присылать чужой текст или reporter_id.

Можно пожаловаться только на доступную опубликованную секцию, опубликованный отзыв или видимое медиа опубликованной секции/отзыва. Чужие черновики по ID не раскрываются. Максимум 10 жалоб в час на пользователя. Повторная открытая жалоба от того же пользователя на тот же объект — `409 report_exists`. Разные пользователи могут пожаловаться на один объект.

Успех `201`: объект жалобы. Отправка не скрывает объект автоматически.

## Очереди модератора

Нужны Bearer-токен и **текущая** роль `moderator` в users:

| Маршрут | Что возвращает |
|---|---|
| `GET /api/v1/moderation/activities` | Секции на модерации — прежняя отдельная очередь |
| `GET /api/v1/moderation/reports` | Все открытые жалобы |
| `GET /api/v1/moderation/reports/activities` | Жалобы на секции/услуги |
| `GET /api/v1/moderation/reports/reviews` | Жалобы на отзывы |
| `GET /api/v1/moderation/reports/media` | Жалобы на фото/видео |

Для жалоб доступны `page`, `limit`, `status=open|hidden|dismissed`. По умолчанию открытые. У общего списка также `target_type=card|review|media`; раздельный маршрут задаёт тип сам. Формат `{items,total,page,limit}`, старые жалобы первыми.

Каждая жалоба содержит `id`, `target_type`, `target_id`, `card_id`, `card_slug`, `card_title`, `target_excerpt`, `reporter_name`, `reason`, `detail`, `status`, `hide_reason`, `created_at`, `updated_at`. ID — строки. `target_excerpt` — снимок названия секции, текста отзыва либо пути медиа на момент жалобы.

Решение: `POST /api/v1/moderation/reports/{reportID}/decision`:

```json
{"action":"hide","reason":"Нарушение правил публикации"}
```

Или `{"action":"dismiss"}` для отклонения жалобы.

При hide причина обязательна, до 1000 символов. Жалоба получает `hidden`; секция — `rejected` с причиной, отзыв — `hidden_by_report` с причиной, медиа — `is_hidden=true`. Они исчезают из соответствующих публичных списков. Физический файл при скрытии остаётся на диске; текущая статическая раздача не отзывает ранее известный прямой URL. Для секций сохраняется существующий процесс редактирования/повторной подачи владельцем.

При dismiss объект не меняется, жалоба получает `dismissed`. Решение и изменение объекта сохраняются одной транзакцией. Сохраняются ID модератора и время. Повтор того же действия возвращает прежнюю жалобу; смена уже принятого действия — `409 already_decided`. Ответ `200 {report: ...}`. Обычный пользователь получает `403`, неавторизованный — `401`.

Комментарии к отзывам и жалобы на них пока не поддерживаются: API комментариев в текущем backend отсутствует. `target_type=comment` будет отклонён.

## Почему текущая витрина показывала неверный результат

В ReviewsBlock.tsx исходной версии frontend:

- publish сразу рисует локальный отзыв и сообщение успеха;
- на backend уходит только JSON с текстом, ответ сервера не проверяется;
- выбранные файлы остаются blob-превью в браузере и не загружаются;
- новый локальный отзыв заменяет прежние локальные отзывы;
- исходный адаптер API задаёт `reviews: []`, не загружая публичный список;
- кнопка жалобы пока показывает локальное сообщение вместо POST.

Backend теперь предоставляет перечисленные маршруты, но фронтенд данной задачей не менялся. Для подключения нужно: дождаться 201 при создании, взять реальный reviewID, отправить файлы, прочитать список, показать ошибки 403/409/413/415/500. Не выводить успех до ответа сервера. Сравнивать авторов по author_id, а не по отображаемому имени. Для секций, отзывов и медиа отправлять жалобы с реальным ID. Модератору вывести три очереди по маршрутам выше. Proxy должен пропускать эти запросы и Bearer-токен сессии.

## Проверка curl

Задайте BASE, TOKEN (первый читатель), TOKEN2 (другой читатель) и MOD_TOKEN. Используйте реальный ID опубликованной секции. Владельцу нельзя писать отзыв на свою секцию.

```bash
ACTIVITY_ID=12
curl -i -X POST "$BASE/api/v1/activities/$ACTIVITY_ID/reviews" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"text":"Первый отзыв о занятии"}'
curl -i -X POST "$BASE/api/v1/activities/$ACTIVITY_ID/reviews" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" -d '{"text":"Второй отзыв от другого пользователя"}'
curl -sS "$BASE/api/v1/activities/$ACTIVITY_ID/reviews?page=1&limit=20"
```

Подставьте reviewID из первого ответа:

```bash
REVIEW_ID=8
curl -i -X POST "$BASE/api/v1/reviews/$REVIEW_ID/photos" -H "Authorization: Bearer $TOKEN" -F 'file=@/полный/путь/photo.jpg'
curl -i -X POST "$BASE/api/v1/reviews/$REVIEW_ID/videos" -H "Authorization: Bearer $TOKEN" -F 'file=@/полный/путь/video.mp4'
curl -i -X POST "$BASE/api/v1/reports" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" -d "{\"target_type\":\"review\",\"target_id\":\"$REVIEW_ID\",\"reason\":\"Тест жалобы\"}"
curl -i "$BASE/api/v1/moderation/reports/reviews?page=1&limit=20" -H "Authorization: Bearer $MOD_TOKEN"
```

В жалобе на секцию используйте target_type=card и ID секции. На вложение — target_type=media и ID загрузки.

```bash
REPORT_ID=1
curl -i -X POST "$BASE/api/v1/moderation/reports/$REPORT_ID/decision" -H "Authorization: Bearer $MOD_TOKEN" -H "Content-Type: application/json" -d '{"action":"dismiss"}'
```

Для проверки hide используйте другую открытую тестовую жалобу: это действительно скрывает соответствующий объект.
