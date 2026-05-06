const router = require('express').Router();
const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const { authenticate, requireRole } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { LEGAL_TYPES, ensureProfile } = require('./legal');

router.use(authenticate, requireRole('ADMIN'));

// ─────────────────────────────────────
// ЮРИДИЧЕСКАЯ ИНФОРМАЦИЯ
// ─────────────────────────────────────

// GET /api/admin/legal
router.get('/legal', async (req, res, next) => {
  try {
    const [profile, documents] = await Promise.all([
      ensureProfile(),
      prisma.legalDocumentVersion.findMany({
        orderBy: [{ type: 'asc' }, { effectiveFrom: 'desc' }],
      }),
    ]);

    res.json({ profile, documents });
  } catch (err) { next(err); }
});

// PUT /api/admin/legal/profile
router.put('/legal/profile', async (req, res, next) => {
  try {
    const allowed = [
      'brand', 'legalName', 'shortName', 'director', 'inn', 'kpp', 'ogrn',
      'address', 'registrationDate', 'workHours', 'supportPhone', 'supportEmail',
      'serviceTitle', 'serviceDescription', 'serviceCountry', 'serviceCurrency',
      'serviceWarranty', 'serviceLifetime', 'serviceSafety',
    ];
    const data = {};

    for (const key of allowed) {
      if (typeof req.body[key] === 'string') data[key] = req.body[key].trim();
    }

    const missing = allowed.filter((key) => !data[key]);
    if (missing.length) {
      return res.status(400).json({ error: `Заполните поля: ${missing.join(', ')}` });
    }

    const profile = await prisma.legalProfile.upsert({
      where: { id: 'main' },
      create: { id: 'main', ...data },
      update: data,
    });
    res.json(profile);
  } catch (err) { next(err); }
});

// POST /api/admin/legal/documents — создать новую версию документа
router.post('/legal/documents', [
  body('type').isIn(LEGAL_TYPES),
  body('title').trim().notEmpty(),
  body('content').trim().notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { type, title, content } = req.body;
    const now = new Date();

    const document = await prisma.$transaction(async (tx) => {
      await tx.legalDocumentVersion.updateMany({
        where: { type, effectiveTo: null },
        data: { effectiveTo: now },
      });

      return tx.legalDocumentVersion.create({
        data: {
          type,
          title: title.trim(),
          content: content.trim(),
          effectiveFrom: now,
        },
      });
    });

    res.status(201).json(document);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────
// АНАЛИТИКА
// ─────────────────────────────────────

// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalTrainers,
      totalTrainings,
      totalBookings,
      revenueResult,
      activeTrainings,
      newUsersThisMonth,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'TRAINER' } }),
      prisma.training.count(),
      prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
      prisma.training.count({ where: { status: { in: ['SCHEDULED', 'LIVE'] } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    ]);

    res.json({
      totalUsers,
      totalTrainers,
      totalTrainings,
      totalBookings,
      totalRevenue: revenueResult._sum.amount || 0,
      activeTrainings,
      newUsersThisMonth,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────
// ПОЛЬЗОВАТЕЛИ
// ─────────────────────────────────────

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const { search, role, isBlocked, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (role) where.role = role;
    if (isBlocked !== undefined) where.isBlocked = isBlocked === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, phone: true,
          role: true, isBlocked: true, avatarUrl: true, createdAt: true,
          _count: { select: { bookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
    ]);

    res.json({ total, page: Number(page), data: users });
  } catch (err) { next(err); }
});

// PATCH /api/admin/users/:id/block — заблокировать / разблокировать
router.patch('/users/:id/block', async (req, res, next) => {
  try {
    const { isBlocked } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBlocked: Boolean(isBlocked) },
      select: { id: true, name: true, isBlocked: true },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH /api/admin/users/:id/role — изменить роль
router.patch('/users/:id/role', [
  body('role').isIn(['STUDENT', 'TRAINER', 'ADMIN']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: req.body.role },
      select: { id: true, name: true, role: true },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────
// ТРЕНЕРЫ
// ─────────────────────────────────────

// POST /api/admin/trainers — создать аккаунт тренера
router.post('/trainers', [
  body('email').isEmail(),
  body('name').notEmpty(),
  body('password').isLength({ min: 6 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, name, password, avatarUrl } = req.body;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Email уже занят' });

    const hashed = await bcrypt.hash(password, 10);
    const trainer = await prisma.user.create({
      data: { email, name, password: hashed, role: 'TRAINER', avatarUrl },
    });

    const { password: _, ...safe } = trainer;
    res.status(201).json(safe);
  } catch (err) { next(err); }
});

// GET /api/admin/trainers — список тренеров с расширенной статистикой
router.get('/trainers', async (req, res, next) => {
  try {
    const trainers = await prisma.user.findMany({
      where: { role: 'TRAINER' },
      select: {
        id: true, name: true, email: true, phone: true,
        avatarUrl: true, isBlocked: true, createdAt: true,
        _count: {
          select: {
            trainingsAsTrainer: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(trainers);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────
// ТРЕНИРОВКИ
// ─────────────────────────────────────

// GET /api/admin/trainings
router.get('/trainings', async (req, res, next) => {
  try {
    const { status, direction, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (status) where.status = status;
    if (direction) where.direction = direction;

    const [total, trainings] = await Promise.all([
      prisma.training.count({ where }),
      prisma.training.findMany({
        where,
        include: {
          trainer: { select: { id: true, name: true } },
          _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
        },
        orderBy: { startAt: 'desc' },
        skip,
        take: Number(limit),
      }),
    ]);

    res.json({ total, page: Number(page), data: trainings });
  } catch (err) { next(err); }
});

// POST /api/admin/trainings — создать тренировку для выбранного тренера без временных ограничений
router.post('/trainings', [
  body('title').trim().notEmpty().withMessage('Название обязательно'),
  body('trainerId').isUUID().withMessage('Выберите тренера'),
  body('direction').isIn(['YOGA', 'PILATES']).withMessage('Направление: YOGA или PILATES'),
  body('level').isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  body('startAt').isISO8601().withMessage('Неверный формат даты'),
  body('durationMin').isInt({ min: 15 }).withMessage('Длительность минимум 15 минут'),
  body('maxSlots').isInt({ min: 1 }).withMessage('Минимум 1 место'),
  body('price').isInt({ min: 0 }).withMessage('Цена не может быть отрицательной'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, description, trainerId, direction, level, startAt, durationMin, maxSlots, price } = req.body;

    const trainer = await prisma.user.findFirst({
      where: { id: trainerId, role: 'TRAINER', isBlocked: false },
      select: { id: true },
    });
    if (!trainer) return res.status(400).json({ error: 'Тренер не найден или заблокирован' });

    const training = await prisma.training.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        trainerId,
        direction,
        level,
        startAt: new Date(startAt),
        durationMin: Number(durationMin),
        maxSlots: Number(maxSlots),
        price: Number(price),
      },
      include: {
        trainer: { select: { id: true, name: true } },
        _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
      },
    });

    res.status(201).json(training);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────
// ПЛАТЕЖИ
// ─────────────────────────────────────

// GET /api/admin/payments
router.get('/payments', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (status) where.status = status;

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          booking: {
            include: { training: { select: { id: true, title: true, startAt: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
    ]);

    res.json({ total, page: Number(page), data: payments });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────
// ЗАЯВКИ ТРЕНЕРОВ
// ─────────────────────────────────────

// GET /api/admin/trainer-requests
router.get('/trainer-requests', async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;

    let users;
    if (status === 'pending') {
      users = await prisma.user.findMany({
        where: { trainerRequest: true, role: 'STUDENT' },
        select: {
          id: true, name: true, email: true, phone: true,
          avatarUrl: true, trainerBio: true, createdAt: true, role: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      users = await prisma.user.findMany({
        where: { trainerRequest: true, role: 'TRAINER' },
        select: {
          id: true, name: true, email: true, phone: true,
          avatarUrl: true, trainerBio: true, createdAt: true, role: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    res.json(users);
  } catch (err) { next(err); }
});

// PATCH /api/admin/trainer-requests/:id/approve — одобрить
router.patch('/trainer-requests/:id/approve', async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { role: 'TRAINER', trainerRequest: true },
    });

    await prisma.notification.create({
      data: {
        userId: req.params.id,
        type:   'TRAINER_APPROVED',
        title:  'Заявка одобрена',
        body:   'Поздравляем! Ваша заявка на роль тренера одобрена. Теперь вы можете создавать тренировки.',
      },
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/admin/trainer-requests/:id/reject — отклонить
router.patch('/trainer-requests/:id/reject', async (req, res, next) => {
  try {
    const { reason } = req.body;

    await prisma.user.update({
      where: { id: req.params.id },
      data: { trainerRequest: false },
    });

    await prisma.notification.create({
      data: {
        userId: req.params.id,
        type:   'TRAINER_REJECTED',
        title:  'Заявка отклонена',
        body:   reason || 'Ваша заявка на роль тренера была отклонена.',
      },
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────
// МОДЕРАЦИЯ
// ─────────────────────────────────────

// GET /api/admin/moderation
router.get('/moderation', async (req, res, next) => {
  try {
    const { status = 'PENDING' } = req.query;
    const requests = await prisma.moderationRequest.findMany({
      where: { status },
      include: {
        training: { select: { id: true, title: true, description: true, trainerId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (err) { next(err); }
});

// PATCH /api/admin/moderation/:id — одобрить или отклонить
router.patch('/moderation/:id', [
  body('status').isIn(['APPROVED', 'REJECTED']),
], async (req, res, next) => {
  try {
    const { status, reviewNote } = req.body;
    const request = await prisma.moderationRequest.findUniqueOrThrow({
      where: { id: req.params.id },
    });

    await prisma.moderationRequest.update({
      where: { id: req.params.id },
      data: { status, reviewNote, reviewedAt: new Date() },
    });

    // Если одобрено — применить изменение
    if (status === 'APPROVED') {
      await prisma.training.update({
        where: { id: request.trainingId },
        data: { [request.field]: request.newValue },
      });
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
