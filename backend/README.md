# Yoga & Pilates — Backend

Node.js + Express + PostgreSQL + WebRTC (Socket.io) backend для платформы онлайн-тренировок.

## Быстрый старт

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
# Заполнить DATABASE_URL и JWT_SECRET
```

### SMS через МТС Exolve

Для локальной разработки без реальной отправки оставьте:

```env
SMS_PROVIDER=stub
```

Для теста через купленный/тестовый номер Exolve (вариант A):

```env
SMS_PROVIDER=exolve
EXOLVE_API_KEY=ваш_api_ключ_приложения
EXOLVE_SMS_SENDER=79991112233
```

Для отправки от альфа-имени после согласования у операторов (вариант B):

```env
SMS_PROVIDER=exolve
EXOLVE_API_KEY=ваш_api_ключ_приложения
EXOLVE_SMS_SENDER=YogaApp
```

`EXOLVE_SMS_SENDER` должен быть либо номером Exolve, который принадлежит приложению, либо активным альфа-именем со статусом `1` в Exolve.

### 3. Запустить PostgreSQL (через Docker)

```bash
docker-compose up db -d
```

### 4. Применить миграции и сгенерировать клиент

```bash
npm run db:migrate    # создаёт таблицы
npm run db:generate   # генерирует Prisma Client
```

### 5. Заполнить тестовыми данными

```bash
npm run db:seed
```

### 6. Запустить сервер

```bash
npm run dev    # с hot-reload
npm start      # продакшн
```

Сервер запустится на `http://localhost:4000`

---

## Запуск через Docker Compose (всё сразу)

```bash
docker-compose up --build
```

---

## API Endpoints

### Auth
| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация по email |
| POST | `/api/auth/login` | Логин по email |
| POST | `/api/auth/phone/send-otp` | Отправить SMS код |
| POST | `/api/auth/phone/verify-otp` | Подтвердить SMS код |
| POST | `/api/auth/telegram` | Telegram Login |
| GET  | `/api/auth/me` | Текущий пользователь |

### Тренировки
| Метод | URL | Описание |
|-------|-----|----------|
| GET  | `/api/trainings` | Каталог (фильтры: direction, level, trainerId, from, to) |
| GET  | `/api/trainings/:id` | Карточка тренировки |
| POST | `/api/trainings` | Создать тренировку (тренер) |
| PATCH | `/api/trainings/:id` | Редактировать |
| DELETE | `/api/trainings/:id` | Отменить |
| GET  | `/api/trainings/trainer/mine` | Мои тренировки (тренер) |

### Записи
| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/bookings` | Записаться на тренировку |
| DELETE | `/api/bookings/:id` | Отменить запись |
| GET  | `/api/bookings/my` | Мои записи |
| GET  | `/api/bookings/training/:id` | Участники (тренер) |

### Платежи
| Метод | URL | Описание |
|-------|-----|----------|
| GET  | `/api/payments/my` | История платежей |
| POST | `/api/payments/webhook` | Вебхук ЮKassa |
| POST | `/api/payments/stub-confirm` | Подтвердить оплату (только dev) |
| POST | `/api/payments/:id/refund` | Возврат (админ) |

### Комнаты
| Метод | URL | Описание |
|-------|-----|----------|
| GET  | `/api/rooms/:trainingId` | Состояние комнаты + доступ |

### История
| Метод | URL | Описание |
|-------|-----|----------|
| GET  | `/api/history` | История тренировок |

### Уведомления
| Метод | URL | Описание |
|-------|-----|----------|
| GET  | `/api/notifications` | Список уведомлений |
| PATCH | `/api/notifications/:id/read` | Прочитать одно |
| PATCH | `/api/notifications/read-all` | Прочитать все |

### Пользователи
| Метод | URL | Описание |
|-------|-----|----------|
| GET  | `/api/users/me` | Мой профиль |
| PATCH | `/api/users/me` | Обновить профиль |
| PATCH | `/api/users/me/password` | Сменить пароль |
| GET  | `/api/users/trainers` | Список тренеров |
| GET  | `/api/users/trainers/:id` | Профиль тренера |

### Админ
| Метод | URL | Описание |
|-------|-----|----------|
| GET  | `/api/admin/stats` | Общая статистика |
| GET  | `/api/admin/users` | Все пользователи |
| PATCH | `/api/admin/users/:id/block` | Блокировка |
| PATCH | `/api/admin/users/:id/role` | Изменить роль |
| POST | `/api/admin/trainers` | Создать тренера |
| GET  | `/api/admin/trainers` | Список тренеров |
| GET  | `/api/admin/trainings` | Все тренировки |
| GET  | `/api/admin/payments` | Все платежи |

---

## WebSocket Events (Socket.io)

Подключение: `ws://localhost:4000` с токеном в `auth.token`

### Клиент → Сервер
| Event | Payload | Описание |
|-------|---------|----------|
| `room:join` | `{ trainingId }` | Войти в комнату |
| `room:leave` | — | Выйти из комнаты |
| `rtc:offer` | `{ targetUserId, offer }` | SDP offer |
| `rtc:answer` | `{ targetUserId, answer }` | SDP answer |
| `rtc:ice-candidate` | `{ targetUserId, candidate }` | ICE кандидат |
| `media:toggle` | `{ kind, enabled }` | Вкл/выкл камера/микрофон |
| `trainer:mute-user` | `{ targetUserId }` | Тренер мьютит ученика |

### Сервер → Клиент
| Event | Payload | Описание |
|-------|---------|----------|
| `room:joined` | `{ roomId, isTrainer, participants, iceServers }` | Успешное подключение |
| `room:user-joined` | `{ userId, name, isTrainer }` | Новый участник |
| `room:user-left` | `{ userId }` | Участник вышел |
| `room:ended` | — | Тренировка завершена тренером |
| `rtc:offer` | `{ fromUserId, offer }` | Входящий offer |
| `rtc:answer` | `{ fromUserId, answer }` | Входящий answer |
| `rtc:ice-candidate` | `{ fromUserId, candidate }` | Входящий ICE |
| `media:user-toggle` | `{ userId, kind, enabled }` | Смена медиа у участника |
| `trainer:force-mute` | — | Тренер заглушил тебя |

---

## Заглушки — что заменить для прода

| Сервис | Файл | Что нужно |
|--------|------|-----------|
| SMS | `src/services/smsService.js` | EXOLVE_API_KEY + номер или альфа-имя отправителя |
| ЮKassa | `src/services/paymentService.js` | SHOP_ID + SECRET_KEY |
| Firebase | `src/services/pushService.js` | Service Account JSON |
| Telegram | `src/controllers/authController.js` | BOT_TOKEN + проверка hash |
| OTP store | `src/controllers/authController.js` | Заменить Map на Redis |
| TURN-сервер | `.env` | TURN_URL + credentials |
