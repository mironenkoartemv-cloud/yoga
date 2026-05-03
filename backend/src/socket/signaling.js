const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const {
  TRAINER_RECONNECT_GRACE_MIN,
  getJoinPolicy,
  getRoomWindow,
} = require('../services/roomPolicy');
const outcomeService = require('../services/trainingOutcomeService');

let io;
const startDeadlineTimers = new Map();
const trainerReconnectTimers = new Map();

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || '').split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Middleware — проверка JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('AUTH_REQUIRED'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user || user.isBlocked) return next(new Error('AUTH_FAILED'));

      socket.user = user;
      next();
    } catch {
      next(new Error('AUTH_FAILED'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Connected: ${socket.user.name} (${socket.user.role})`);

    // ──────────────────────────────────────────
    // JOIN ROOM
    // ──────────────────────────────────────────
    socket.on('room:join', async ({ trainingId }) => {
      try {
        const training = await prisma.training.findUnique({ where: { id: trainingId } });
        if (!training) return socket.emit('error', { message: 'Тренировка не найдена' });

        const isTrainer = training.trainerId === socket.user.id;

        // Ученик должен иметь подтверждённую запись
        let booking = null;
        if (!isTrainer) {
          booking = await prisma.booking.findFirst({
            where: { userId: socket.user.id, trainingId, status: 'CONFIRMED' },
          });
        }

        const policy = getJoinPolicy({
          training,
          isTrainer,
          hasConfirmedBooking: Boolean(booking),
        });
        if (!policy.canJoin) return socket.emit('error', { message: policy.reason });

        // Создать или найти комнату
        let room = await prisma.room.findUnique({ where: { trainingId } });
        if (!room) {
          room = await prisma.room.create({
            data: { trainingId, status: 'WAITING' },
          });
        }

        const roomId = `training:${trainingId}`;
        socket.join(roomId);
        socket.roomId = roomId;
        socket.trainingId = trainingId;
        socket.isTrainer = isTrainer;

        // Обновить socketId участника
        await prisma.roomParticipant.upsert({
          where: { roomId_userId: { roomId: room.id, userId: socket.user.id } },
          update: { socketId: socket.id, leftAt: null },
          create: { roomId: room.id, userId: socket.user.id, socketId: socket.id },
        });

        // Список участников для тренера
        const participants = await getParticipants(room.id);

        socket.emit('room:joined', {
          roomId,
          trainingId,
          isTrainer,
          participants,
          iceServers: getIceServers(),
          roomStatus: room.status,
          trainingStatus: training.status,
          window: getRoomWindow(training),
        });

        if (room.status === 'LIVE' || training.status === 'LIVE') {
          socket.emit('room:started');
        } else {
          ensureStartDeadlineTimer(trainingId, training);
        }

        if (isTrainer) {
          clearTrainerReconnectTimer(trainingId);
          socket.to(roomId).emit('trainer:reconnected');
        }

        // Уведомить других участников
        socket.to(roomId).emit('room:user-joined', {
          userId: socket.user.id,
          name: socket.user.name,
          avatarUrl: socket.user.avatarUrl,
          isTrainer,
        });

        console.log(`[WS] ${socket.user.name} joined room ${roomId}`);
      } catch (err) {
        console.error('[WS room:join]', err);
        socket.emit('error', { message: 'Ошибка подключения к комнате' });
      }
    });

    socket.on('room:start', async () => {
      try {
        if (!socket.isTrainer || !socket.trainingId) return;

        const training = await prisma.training.findUnique({ where: { id: socket.trainingId } });
        if (!training) return socket.emit('error', { message: 'Тренировка не найдена' });

        const { startAt, startDeadlineAt } = getRoomWindow(training);
        const now = new Date();
        if (now < startAt) return socket.emit('error', { message: 'Начать можно только в момент старта занятия' });
        if (now > startDeadlineAt) return socket.emit('error', { message: 'Время старта истекло' });

        let room = await prisma.room.findUnique({ where: { trainingId: socket.trainingId } });
        if (!room) {
          room = await prisma.room.create({ data: { trainingId: socket.trainingId } });
        }

        await prisma.$transaction([
          prisma.room.update({
            where: { id: room.id },
            data: { status: 'LIVE', startedAt: now },
          }),
          prisma.training.update({
            where: { id: socket.trainingId },
            data: { status: 'LIVE' },
          }),
        ]);

        clearStartDeadlineTimer(socket.trainingId);
        io.to(socket.roomId).emit('room:started');
      } catch (err) {
        console.error('[WS room:start]', err);
        socket.emit('error', { message: 'Не удалось начать тренировку' });
      }
    });

    socket.on('room:end', async () => {
      try {
        if (!socket.isTrainer || !socket.trainingId) return;
        clearTrainerReconnectTimer(socket.trainingId);
        await outcomeService.finishNormally(socket.trainingId);

        const room = await prisma.room.findUnique({ where: { trainingId: socket.trainingId } });
        if (room) {
          await prisma.room.update({
            where: { id: room.id },
            data: { status: 'ENDED', endedAt: new Date() },
          });
        }

        io.to(socket.roomId).emit('room:ended', {
          reason: 'NORMAL_FINISH',
          message: 'Тренировка завершена. Для поддержания формы запишитесь на следующее занятие — если у вас есть скидка, она применится к новой записи.',
        });
      } catch (err) {
        console.error('[WS room:end]', err);
        socket.emit('error', { message: 'Не удалось завершить тренировку' });
      }
    });

    // ──────────────────────────────────────────
    // WebRTC SIGNALING
    // Схема: ученик шлёт offer тренеру,
    //        тренер отвечает answer конкретному ученику,
    //        ICE candidates обмениваются напрямую
    // ──────────────────────────────────────────

    socket.on('rtc:offer', ({ targetUserId, offer }) => {
      const targetSocket = findSocketByUserId(targetUserId);
      if (targetSocket) {
        targetSocket.emit('rtc:offer', {
          fromUserId: socket.user.id,
          fromName: socket.user.name,
          offer,
        });
      }
    });

    socket.on('rtc:answer', ({ targetUserId, answer }) => {
      const targetSocket = findSocketByUserId(targetUserId);
      if (targetSocket) {
        targetSocket.emit('rtc:answer', {
          fromUserId: socket.user.id,
          answer,
        });
      }
    });

    socket.on('rtc:ice-candidate', ({ targetUserId, candidate }) => {
      const targetSocket = findSocketByUserId(targetUserId);
      if (targetSocket) {
        targetSocket.emit('rtc:ice-candidate', {
          fromUserId: socket.user.id,
          candidate,
        });
      }
    });

    // ──────────────────────────────────────────
    // MEDIA CONTROL
    // ──────────────────────────────────────────

    socket.on('media:toggle', ({ kind, enabled }) => {
      // kind: 'audio' | 'video'
      socket.to(socket.roomId).emit('media:user-toggle', {
        userId: socket.user.id,
        kind,
        enabled,
      });
    });

    // Тренер отключает микрофон ученику
    socket.on('trainer:mute-user', ({ targetUserId }) => {
      if (!socket.isTrainer) return;
      const targetSocket = findSocketByUserId(targetUserId);
      if (targetSocket) {
        targetSocket.emit('trainer:force-mute');
      }
    });

    // ──────────────────────────────────────────
    // LEAVE / DISCONNECT
    // ──────────────────────────────────────────

    socket.on('room:leave', () => handleLeave(socket));
    socket.on('disconnect', () => handleLeave(socket));
  });
};

const handleLeave = async (socket) => {
  if (!socket.trainingId) return;

  try {
    const room = await prisma.room.findUnique({
      where: { trainingId: socket.trainingId },
    });
    if (!room) return;

    await prisma.roomParticipant.updateMany({
      where: { roomId: room.id, userId: socket.user.id },
      data: { leftAt: new Date() },
    });

    socket.to(socket.roomId).emit('room:user-left', { userId: socket.user.id });

    if (socket.isTrainer) {
      const training = await prisma.training.findUnique({ where: { id: socket.trainingId } });
      if (training?.status === 'LIVE') {
        socket.to(socket.roomId).emit('trainer:reconnecting', {
          timeoutSec: TRAINER_RECONNECT_GRACE_MIN * 60,
        });
        ensureTrainerReconnectTimer(socket.trainingId, socket.roomId);
      }
    }

    console.log(`[WS] ${socket.user.name} left room ${socket.roomId}`);
  } catch (err) {
    console.error('[WS handleLeave]', err);
  }
};

const ensureStartDeadlineTimer = (trainingId, training) => {
  if (startDeadlineTimers.has(trainingId)) return;

  const { startDeadlineAt } = getRoomWindow(training);
  const delay = Math.max(0, startDeadlineAt.getTime() - Date.now());
  const timer = setTimeout(async () => {
    try {
      const current = await prisma.training.findUnique({ where: { id: trainingId } });
      if (!current || current.status !== 'SCHEDULED') return;

      const roomId = `training:${trainingId}`;
      await outcomeService.cancelBeforeStartByTrainer(trainingId);
      io.to(roomId).emit('room:cancelled', {
        reason: 'TRAINER_NO_SHOW',
        message: 'Тренер не смог начать занятие. Нам очень жаль. Мы вернём оплату за это занятие полностью. А ещё сохранили для вас скидку 10% на любую новую запись — она применится к следующей оплате.',
      });
    } catch (err) {
      console.error('[WS start deadline]', err);
    } finally {
      clearStartDeadlineTimer(trainingId);
    }
  }, delay);

  startDeadlineTimers.set(trainingId, timer);
};

const clearStartDeadlineTimer = (trainingId) => {
  const timer = startDeadlineTimers.get(trainingId);
  if (timer) clearTimeout(timer);
  startDeadlineTimers.delete(trainingId);
};

const ensureTrainerReconnectTimer = (trainingId, roomId) => {
  clearTrainerReconnectTimer(trainingId);

  const timer = setTimeout(async () => {
    try {
      const current = await prisma.training.findUnique({ where: { id: trainingId } });
      if (!current || current.status !== 'LIVE') return;

      const result = await outcomeService.failDuringClassByTrainerDisconnect(trainingId);
      const room = await prisma.room.findUnique({ where: { trainingId } });
      if (room) {
        await prisma.room.update({
          where: { id: room.id },
          data: { status: 'ENDED', endedAt: new Date() },
        });
      }
      io.to(roomId).emit('room:ended', {
        reason: 'TRAINER_DISCONNECT',
        refundPercent: result.refundPercent,
        message: `Тренер не смог переподключиться. Мы отправили на возврат ${result.refundPercent}% оплаты.`,
      });
    } catch (err) {
      console.error('[WS reconnect deadline]', err);
    } finally {
      clearTrainerReconnectTimer(trainingId);
    }
  }, TRAINER_RECONNECT_GRACE_MIN * 60 * 1000);

  trainerReconnectTimers.set(trainingId, timer);
};

const clearTrainerReconnectTimer = (trainingId) => {
  const timer = trainerReconnectTimers.get(trainingId);
  if (timer) clearTimeout(timer);
  trainerReconnectTimers.delete(trainingId);
};

const getParticipants = async (roomId) => {
  const parts = await prisma.roomParticipant.findMany({
    where: { roomId, leftAt: null },
    include: { user: { select: { id: true, name: true, avatarUrl: true, role: true } } },
  });
  return parts.map((p) => ({ ...p.user, socketId: p.socketId }));
};

const getIceServers = () => {
  const servers = [{ urls: process.env.STUN_URL || 'stun:stun.l.google.com:19302' }];

  if (process.env.TURN_URL) {
    servers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  return servers;
};

const findSocketByUserId = (userId) => {
  for (const [, socket] of io.sockets.sockets) {
    if (socket.user?.id === userId) return socket;
  }
  return null;
};

module.exports = { initSocket };
