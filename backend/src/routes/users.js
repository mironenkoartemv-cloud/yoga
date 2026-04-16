const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// GET /api/users/me — профиль текущего пользователя
router.get('/me', authenticate, (req, res) => {
  const { password, ...user } = req.user;
  res.json(user);
});

// PATCH /api/users/me — обновить профиль
router.patch('/me', authenticate, [
  body('name').optional().notEmpty().withMessage('Имя не может быть пустым'),
  body('email').optional().isEmail().withMessage('Неверный email'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const allowed = ['name', 'avatarUrl', 'email'];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });

    const { password, ...safe } = updated;
    res.json(safe);
  } catch (err) { next(err); }
});

// PATCH /api/users/me/password — сменить пароль
router.patch('/me/password', authenticate, [
  body('oldPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { oldPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.password) {
      return res.status(400).json({ error: 'Аккаунт создан через соцсеть, пароль не установлен' });
    }

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Неверный текущий пароль' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });

    res.json({ message: 'Пароль обновлён' });
  } catch (err) { next(err); }
});

// GET /api/users/trainers — список тренеров (публично)
router.get('/trainers', async (req, res, next) => {
  try {
    const trainers = await prisma.user.findMany({
      where: { role: 'TRAINER', isBlocked: false },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        _count: { select: { trainingsAsTrainer: { where: { status: 'FINISHED' } } } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(trainers.map(t => ({
      ...t,
      completedTrainings: t._count.trainingsAsTrainer,
      _count: undefined,
    })));
  } catch (err) { next(err); }
});

// GET /api/users/trainers/:id — профиль тренера
router.get('/trainers/:id', async (req, res, next) => {
  try {
    const trainer = await prisma.user.findFirstOrThrow({
      where: { id: req.params.id, role: 'TRAINER' },
      select: {
        id: true, name: true, avatarUrl: true,
        trainingsAsTrainer: {
          where: { status: { not: 'CANCELLED' }, startAt: { gte: new Date() } },
          orderBy: { startAt: 'asc' },
          take: 5,
        },
        _count: { select: { trainingsAsTrainer: { where: { status: 'FINISHED' } } } },
      },
    });

    res.json({
      ...trainer,
      completedTrainings: trainer._count.trainingsAsTrainer,
      _count: undefined,
    });
  } catch (err) { next(err); }
});

module.exports = router;
