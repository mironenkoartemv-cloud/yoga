const router = require('express').Router();
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { getJoinPolicy, getRoomWindow } = require('../services/roomPolicy');

// GET /api/rooms/:trainingId — проверить доступ и получить состояние комнаты
router.get('/:trainingId', authenticate, async (req, res, next) => {
  try {
    const { trainingId } = req.params;

    const training = await prisma.training.findUniqueOrThrow({
      where: { id: trainingId },
      include: { trainer: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const isTrainer = training.trainerId === req.user.id;

    const booking = !isTrainer
      ? await prisma.booking.findFirst({
          where: { userId: req.user.id, trainingId, status: 'CONFIRMED' },
        })
      : null;
    const policy = getJoinPolicy({
      training,
      isTrainer,
      hasConfirmedBooking: Boolean(booking),
    });

    const room = await prisma.room.findUnique({
      where: { trainingId },
      include: {
        participants: {
          where: { leftAt: null },
          include: { user: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        },
      },
    });

    res.json({
      training,
      room,
      isTrainer,
      canJoin: policy.canJoin,
      reason: policy.reason,
      openAt: policy.openAt,
      window: getRoomWindow(training),
    });
  } catch (err) { next(err); }
});

module.exports = router;
