# Backend (MVP)

Локальный backend для прототипа NewsMap:

- источники: NewsAPI (`bbc-news`, `reuters`, `the-new-york-times`, `financial-times`, `the-guardian-uk`)
- логика: `article -> event -> topic`
- язык ответа: RU (переводится на этапе ingestion)
- ограничения: максимум 7 тем и максимум 10 событий в теме
- обновление: раз в сутки (авто) + ручной refresh endpoint

## Запуск

1. Создайте `.env` в корне репозитория (рядом с `package.json`). Backend читает его автоматически:

```bash
NEWS_API_KEY=your_key_here
PORT=8787
TARGET_LANGUAGE=ru
OPENAI_API_KEY=your_openai_key_here
EXPO_PUBLIC_API_URL=http://localhost:8787
```

2. Запустите backend:

```bash
npm run backend
```

## API

- `GET /health`
- `GET /topics`
- `GET /topics/:topicId/events`
- `GET /events/:eventId`
- `POST /admin/refresh` - ручной ingestion из NewsAPI

## Важно для телефона (Expo Go)

Если фронтенд запускается на телефоне, `localhost` указывает на сам телефон, а не на ноутбук.
Тогда в `.env` укажи локальный IP ноутбука:

```bash
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:8787
```
