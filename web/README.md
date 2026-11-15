# Talentro — каталог занятий и услуг Приднестровья

Next.js-приложение витрины Talentro: каталог секций, кружков, студий и услуг для детей и взрослых в Тирасполе, Бендерах и других городах Приднестровья.

## Стек

- Next.js 16 (App Router, SSR)
- React 19 + TypeScript
- Leaflet / OpenStreetMap для карты
- Google OAuth (`@react-oauth/google`)
- Глобальные CSS-токены и адаптивная вёрстка (360–1440 px)
- Vitest + Testing Library
- Docker для деплоя на собственный сервер

## Запуск

```bash
npm install
npm run dev
```

Приложение откроется на `http://localhost:3000`.

## Сборка и production

```bash
npm run build
npm run start
```

## Проверки

```bash
npm run lint
npm test
```

## Переменные окружения

Скопируйте `.env.example` в `.env.local`:

- `NEXT_PUBLIC_API_URL` — адрес Go-бэкенда (каталог, авторизация, медиа). Если не задан, приложение не ходит в API.
- `NEXT_PUBLIC_AUTH_URL` — необязательный адрес сервиса авторизации; по умолчанию совпадает с `NEXT_PUBLIC_API_URL`.
- `NEXT_PUBLIC_SITE_URL` — канонический адрес сайта для `metadataBase`, `robots.txt` и `sitemap.xml`.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — client ID Google OAuth. Без него кнопка Google показывает подсказку, остальные способы входа работают.
- `NEXT_PUBLIC_DEMO_DATA=1` — только для локального просмотра: включает демонстрационные данные без бэкенда.

## Вход и регистрация

- **Google** — аккаунт создаётся автоматически при первом входе.
- **Почта и пароль** — регистрация на `/register`, вход на `/login`; сессию выдаёт бэкенд.
- **Токен тестировщика** — общий секрет стенда (`TESTER_TOKEN` на бэкенде). Открывает демонстрационные разделы кабинета и модерации, данные в базе не меняет. Выдаёт координатор проверки.

## Демо-режим

Тестировщик видит демонстрационные блоки каталога и кабинеты на моках. Для локального просмотра без бэкенда можно включить `NEXT_PUBLIC_DEMO_DATA=1`.

## Структура

```
src/app          маршруты и глобальные стили
src/components   UI-компоненты
src/lib          данные, фильтры, API-клиент, утилиты
public           изображения, иконки PWA, service worker
tests            сквозные проверки данных и API
```

## Деплой

**Vercel.** Framework Preset — Next.js, Root Directory — `frontend/web`, Build Command — `npm run build`. Динамические маршруты требуют Node.js-рантайма (SSR), статический экспорт не используется. Переменные `NEXT_PUBLIC_*` задаются в настройках проекта: они встраиваются в клиентский бандл на этапе сборки.

**Docker.** Из папки `web`:

```bash
docker build -t talentro-web .
docker run -p 3000:3000 --env-file .env.local talentro-web
```
