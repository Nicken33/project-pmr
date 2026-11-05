# Talentro — каталог занятий и услуг Приднестровья

Next.js-приложение витрины Talentro: каталог секций, кружков, студий и услуг для детей и взрослых в Тирасполе, Бендерах и других городах Приднестровья.

## Стек

- Next.js 16 (App Router, SSR)
- React 19 + TypeScript
- Leaflet / OpenStreetMap для карты
- Глобальные CSS-токены и адаптивная вёрстка (360–1440 px)
- Vitest + Testing Library

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

- `NEXT_PUBLIC_API_URL` — адрес бэкенда. Если не задан, приложение работает на демо-данных.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — client ID для входа через Google (необязательно).

## Демо-режим

Без бэкенда используются локальные данные из `src/lib/data.ts`. Вход, избранное и черновики хранятся в `localStorage`:

- любой корректный e-mail и пароль от 6 символов;
- `moder` в e-mail — роль модератора;
- `owner` в e-mail — роль владельца организации «Студия Палитра».

## Структура

```
src/app          маршруты и глобальные стили
src/components   UI-компоненты
src/lib          данные, фильтры, API-клиент, утилиты
public           изображения, иконки PWA, service worker
tests            сквозные проверки данных и API
```

## Деплой

Для Vercel: Framework Preset — Next.js, Root Directory — `frontend/web`, Build Command — `npm run build`. Динамические маршруты требуют Node.js-рантайма (SSR), статический экспорт не используется.
