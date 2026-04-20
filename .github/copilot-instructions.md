## Purpose
Short, actionable guidance for AI coding agents working in this monorepo (Node/Express backend + React/Vite frontend).

## Big picture
- Monorepo with two main services: [backend](backend) (Express API, Prisma, Socket.io signaling) and [frontend](frontend) (React + Vite SPA). Root `docker-compose.yml` can launch DB, backend, and frontend together.
- Realtime flow: frontend uses `socket.io-client` + `useWebRTC.js` hooks; backend exposes signaling in [backend/src/socket/signaling.js](backend/src/socket/signaling.js).

## Key files & commands
- Start everything (recommended for local dev): `docker-compose up --build` (root). See [README.md](README.md) quick-start.
- Backend dev: `cd backend && npm install && npm run dev` (nodemon runs `src/index.js`). Scripts in [backend/package.json](backend/package.json).
- Frontend dev: `cd frontend && npm install && npm run dev` (Vite). Scripts in [frontend/package.json](frontend/package.json).
- DB: Prisma schema at [backend/prisma/schema.prisma](backend/prisma/schema.prisma). Migrate/seed via `npm run db:migrate` and `npm run db:seed` (from `backend`).

## Project conventions & patterns (explicit)
- Routing layer -> controllers -> services: Routes are in [backend/src/routes](backend/src/routes), controllers in [backend/src/controllers](backend/src/controllers), and longer logic or external integrations live in [backend/src/services](backend/src/services).
- Middleware: authentication and errors live in [backend/src/middleware/auth.js](backend/src/middleware/auth.js) and [backend/src/middleware/errorHandler.js](backend/src/middleware/errorHandler.js). Use these consistently when adding endpoints.
- DB access: use Prisma client from [backend/src/config/prisma.js](backend/src/config/prisma.js). Prefer transactions for multi-step writes.
- Environment: secrets and feature stubs are configured in [backend/.env](backend/.env). Many integrations (YooKassa, Firebase, SMS, Telegram) are present as stubs — check `.env` keys before assuming production behavior.

## Realtime / WebRTC specifics
- Signaling is via Socket.io; signaling server code: [backend/src/socket/signaling.js](backend/src/socket/signaling.js).
- Frontend WebRTC helpers: [frontend/src/hooks/useWebRTC.js](frontend/src/hooks/useWebRTC.js) and `useSocket.js`. Look at `room` components (StudentRoom, TrainerRoom) for typical usage.

## Developer workflows & helpful commands
- Full local stack (DB only): `docker-compose up db -d` then run backend and frontend locally (README has exact steps).
- Common backend tasks (from `backend`): `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, `npm run db:studio`.
- Use `nodemon` (`npm run dev`) for fast backend iteration; Vite's `npm run dev` reloads frontend.

## Integration touchpoints to watch
- Payments: YooKassa stubs in [backend/src/services/paymentService.js](backend/src/services/paymentService.js).
- Push: Firebase stub in [backend/src/services/pushService.js](backend/src/services/pushService.js).
- SMS & Telegram: see [backend/.env](backend/.env) and `smsService.js`/`controllers/authController.js` for where they're used.

## PR and code-change guidance for agents
- Prefer minimal, focused changes; preserve existing patterns (route → controller → service).
- When adding endpoints, update the matching route file in [backend/src/routes](backend/src/routes) and corresponding controller; add scheme to Prisma only when DB changes are necessary, then run migrations/seeds.
- For realtime changes, update signaling and check frontend `useWebRTC.js` and `Room` components for compatibility.

## Where to look first when debugging
- Backend logs: startup in [backend/src/index.js](backend/src/index.js) and Express app in [backend/src/app.js](backend/src/app.js).
- DB models/relations: [backend/prisma/schema.prisma](backend/prisma/schema.prisma).
- Realtime flow: [backend/src/socket/signaling.js](backend/src/socket/signaling.js) and [frontend/src/hooks/useWebRTC.js](frontend/src/hooks/useWebRTC.js).

---
If anything above is unclear or you'd like more examples (e.g., typical request/response shapes, Prisma model snippets, or common tests), tell me which area to expand.
