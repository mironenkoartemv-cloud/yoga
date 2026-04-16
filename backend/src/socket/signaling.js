const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

let io;

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
        if (!isTrainer) {
          const booking = await prisma.booking.findFirst({
            where: { userId: socket.user.id, trainingId, status: 'CONFIRMED' },
          });
          if (!booking) return socket.emit('error', { message: 'Нет подтверждённой записи' });
        }

        // Создать или найти комнату
        let room = await prisma.room.findUnique({ where: { trainingId } });
        if (!room) {
          room = await prisma.room.create({
            data: { trainingId, status: isTrainer ? 'LIVE' : 'WAITING' },
          });
        } else if (isTrainer && room.status === 'WAITING') {
          room = await prisma.room.update({
            where: { id: room.id },
            data: { status: 'LIVE', startedAt: new Date() },
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
        });

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

    // Тренер вышел — заканчиваем тренировку
    if (socket.isTrainer) {
      await prisma.room.update({
        where: { id: room.id },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      await prisma.training.update({
        where: { id: socket.trainingId },
        data: { status: 'FINISHED' },
      });
      io.to(socket.roomId).emit('room:ended');
    }

    console.log(`[WS] ${socket.user.name} left room ${socket.roomId}`);
  } catch (err) {
    console.error('[WS handleLeave]', err);
  }
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
