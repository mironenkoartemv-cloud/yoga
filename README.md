# Asana — Yoga & Pilates Online Platform

Монорепо: бэкенд (Node.js) + фронтенд (React + Vite).

```
yoga-app/
├── backend/    — Express API + WebRTC сигналинг
├── frontend/   — React SPA
└── docker-compose.yml
```

---

## Быстрый старт (Docker)

```bash
# Запустить всё одной командой
docker-compose up --build

# Приложение доступно:
#   Frontend:  http://localhost:3000
#   Backend:   http://localhost:4000
#   API docs:  http://localhost:4000/health
```

После первого запуска заполнить тестовыми данными:

```bash
docker-compose exec backend npm run db:seed
```

---

## Локальная разработка (без Docker)

### 1. База данных
```bash
docker-compose up db -d
```

### 2. Backend
```bash
cd backend
cp .env.example .env     # заполнить DATABASE_URL и JWT_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev              # http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev              # http://localhost:3000
```

---

## Тестовые аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| Админ | admin@yoga.app | password123 |
| Тренер | trainer1@yoga.app | password123 |
| Тренер | trainer2@yoga.app | password123 |
| Ученик | student1@yoga.app | password123 |
| Ученик | student2@yoga.app | password123 |
| Ученик | student3@yoga.app | password123 |
| Ученик | student4@yoga.app | password123 |

---

## Прогресс разработки

- [x] **Шаг 1** — Бэкенд + Авторизация (email, телефон, Telegram stub)
- [ ] **Шаг 2** — Каталог тренировок, карточка, запись, оплата
- [ ] **Шаг 3** — Видеокомната (WebRTC)
- [ ] **Шаг 4** — Кабинеты (ученик, тренер)
- [ ] **Шаг 5** — Админка

---

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Zustand |
| Backend | Node.js, Express, Prisma, PostgreSQL |
| Realtime | Socket.io, WebRTC |
| Auth | JWT, bcrypt |
| Payments | ЮKassa (stub) |
| Push | Firebase (stub) |
| SMS | МТС Exolve / stub |
| Deploy | Docker, docker-compose |
