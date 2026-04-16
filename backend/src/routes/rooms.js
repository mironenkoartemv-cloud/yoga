const router = require('express').Router();
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');

// GET /api/rooms/:trainingId — проверить доступ и получить состояние комнаты
router.get('/:trainingId', authenticate, async (req, res, next) => {
  try {
    const { trainingId } = req.params;

    const training = await prisma.training.findUniqueOrThrow({
      where: { id: trainingId },
      include: { trainer: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const isTrainer = training.trainerId === req.user.id;

    if (!isTrainer) {
      const booking = await prisma.booking.findFirst({
        where: { userId: req.user.id, trainingId, status: 'CONFIRMED' },
      });
      if (!booking) {
        return res.status(403).json({ error: 'Нет подтверждённой записи на тренировку' });
      }
    }

    const room = await prisma.room.findUnique({
      where: { trainingId },
      include: {
        participants: {
          where: { leftAt: null },
          include: { user: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        },
      },
    });

    res.json({ training, room, isTrainer });
  } catch (err) { next(err); }
});

module.exports = router;
