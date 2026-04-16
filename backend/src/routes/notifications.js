const router = require('express').Router();
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications — список уведомлений
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [total, notifications, unreadCount] = await Promise.all([
      prisma.notification.count({ where: { userId: req.user.id } }),
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { sentAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    res.json({ total, unreadCount, page: Number(page), data: notifications });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/:id/read — прочитать одно
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/read-all — прочитать все
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
