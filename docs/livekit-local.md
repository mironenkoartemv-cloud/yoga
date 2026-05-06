# Локальный LiveKit

Параллельный контур LiveKit не заменяет текущий `/room/:id`. Для тестов используется отдельный маршрут:

```text
/room-livekit/:trainingId
```

## 1. Запуск LiveKit

Через Docker:

```bash
docker compose -f docker-compose.livekit.yml up
```

Или через установленный `livekit-server`:

```bash
livekit-server --dev --bind 0.0.0.0
```

Dev-режим LiveKit использует:

```text
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

## 2. Backend env

Для локальной разработки можно не задавать переменные: backend возьмет значения выше по умолчанию, если `NODE_ENV !== production`.

Для production обязательно задать:

```text
LIVEKIT_URL=wss://livekit.example.ru
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

## 3. Проверка

1. Запустить Postgres, backend и frontend как обычно.
2. Запустить локальный LiveKit.
3. Открыть тренировку через новый маршрут `/room-livekit/:id`.
4. Открыть вторую сессию браузера под другим пользователем и зайти в тот же маршрут.
