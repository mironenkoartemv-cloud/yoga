const router = require('express').Router();
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');

// GET /api/history — история тренировок пользователя
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      userId: req.user.id,
      status: 'CONFIRMED',
      training: { status: 'FINISHED' },
    };

    const [total, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        include: {
          training: {
            include: {
              trainer: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { training: { startAt: 'desc' } },
        skip,
        take: Number(limit),
      }),
    ]);

    res.json({ total, page: Number(page), limit: Number(limit), data: bookings });
  } catch (err) { next(err); }
});

module.exports = router;
