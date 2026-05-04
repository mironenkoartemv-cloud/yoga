const prisma = require('../config/prisma');
const { validationResult } = require('express-validator');
const { expirePendingBookings } = require('../services/bookingExpiryService');

const MIN_TRAINING_LEAD_HOURS = 24;
const MODERATED_TRAINING_FIELDS = ['title', 'description', 'direction', 'level'];
const DIRECT_TRAINING_FIELDS = ['startAt', 'durationMin', 'maxSlots', 'price'];

const hoursUntil = (date, now = new Date()) => (new Date(date) - now.getTime()) / (1000 * 60 * 60);
const normalizeDirectValue = (key, value) => {
  if (key === 'startAt') return new Date(value);
  if (['durationMin', 'maxSlots', 'price'].includes(key)) return Number(value);
  return value;
};

// GET /api/trainings — каталог с фильтрами
const listTrainings = async (req, res, next) => {
  try {
    await expirePendingBookings();

    const { direction, level, trainerId, from, to, page = 1, limit = 20 } = req.query;

    const now = new Date();
    const where = {
      status: 'SCHEDULED',
      startAt: { gte: now },
    };
    if (direction) where.direction = direction;
    if (level) where.level = level;
    if (trainerId) where.trainerId = trainerId;
    if (from || to) {
      const fromDate = from ? new Date(from) : now;
      where.startAt = { gte: fromDate > now ? fromDate : now };
      if (to) where.startAt.lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [total, trainings] = await Promise.all([
      prisma.training.count({ where }),
      prisma.training.findMany({
        where,
        include: {
          trainer: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { bookings: { where: { status: { in: ['CONFIRMED', 'PENDING'] } } } } },
        },
        orderBy: { startAt: 'asc' },
        skip,
        take: Number(limit),
      }),
    ]);

    const result = trainings.map((t) => ({
      ...t,
      bookedSlots: t._count.bookings,
      availableSlots: t.maxSlots - t._count.bookings,
      _count: undefined,
    }));

    res.json({ total, page: Number(page), limit: Number(limit), data: result });
  } catch (err) { next(err); }
};

// GET /api/trainings/:id
const getTraining = async (req, res, next) => {
  try {
    await expirePendingBookings();

    const training = await prisma.training.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        trainer: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { bookings: { where: { status: { in: ['CONFIRMED', 'PENDING'] } } } } },
      },
    });

    res.json({
      ...training,
      bookedSlots: training._count.bookings,
      availableSlots: training.maxSlots - training._count.bookings,
      _count: undefined,
    });
  } catch (err) { next(err); }
};

// POST /api/trainings — создать тренировку (тренер)
const createTraining = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, description, direction, level, startAt, durationMin, maxSlots, price } = req.body;
    const newStartAt = new Date(startAt);

    if (req.user.role !== 'ADMIN' && hoursUntil(newStartAt) < MIN_TRAINING_LEAD_HOURS) {
      return res.status(400).json({ error: 'Создать тренировку можно не менее чем за 24 часа до старта' });
    }

    const training = await prisma.training.create({
      data: {
        title,
        description,
        trainerId: req.user.id,
        direction,
        level,
        startAt: newStartAt,
        durationMin: Number(durationMin),
        maxSlots: Number(maxSlots),
        price: Number(price),
      },
      include: {
        trainer: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    res.status(201).json(training);
  } catch (err) { next(err); }
};

// PATCH /api/trainings/:id — редактировать тренировку
const updateTraining = async (req, res, next) => {
  try {
    const training = await prisma.training.findUniqueOrThrow({
      where: { id: req.params.id },
    });

    if (req.user.role === 'TRAINER' && training.trainerId !== req.user.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const isAdmin = req.user.role === 'ADMIN';
    const hoursUntilStart = (new Date(training.startAt) - Date.now()) / (1000 * 60 * 60);

    // Тренер не может менять тренировку менее чем за 24 часа
    if (!isAdmin && hoursUntilStart < 24) {
      return res.status(400).json({ error: 'Нельзя изменить тренировку менее чем за 24 часа до старта' });
    }

    const data = {};

    if (isAdmin) {
      // Админ может менять всё
      const allowed = ['title', 'description', 'direction', 'level', 'startAt', 'durationMin', 'maxSlots', 'price', 'status'];
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          data[key] = key === 'startAt' ? new Date(req.body[key]) : req.body[key];
        }
      }
    } else {
      for (const key of DIRECT_TRAINING_FIELDS) {
        if (req.body[key] !== undefined) {
          data[key] = normalizeDirectValue(key, req.body[key]);
        }
      }

      if (data.startAt && hoursUntil(data.startAt) < MIN_TRAINING_LEAD_HOURS) {
        return res.status(400).json({ error: 'Новое время тренировки должно быть не менее чем через 24 часа' });
      }

      const moderatedChanges = MODERATED_TRAINING_FIELDS
        .filter((key) => req.body[key] !== undefined && req.body[key] !== training[key]);

      if (moderatedChanges.length) {
        await prisma.moderationRequest.createMany({
          data: moderatedChanges.map((field) => ({
            trainingId: req.params.id,
            trainerId: req.user.id,
            field,
            newValue: String(req.body[field] ?? ''),
          })),
        });

        if (Object.keys(data).length === 0) {
          return res.status(202).json({
            message: 'Заявка на изменение тренировки отправлена на модерацию',
            pending: true,
          });
        }
      }

    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    const updated = await prisma.training.update({
      where: { id: req.params.id },
      data,
    });

    // Уведомить учеников об изменении времени
    if (data.startAt) {
      await notifyBookedStudents(
        training.id,
        'SCHEDULE_CHANGE',
        'Изменилось время тренировки',
        `Тренировка "${training.title}" перенесена на ${new Date(data.startAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`
      );
    }

    res.json(updated);
  } catch (err) { next(err); }
};

// DELETE /api/trainings/:id — отменить тренировку
const cancelTraining = async (req, res, next) => {
  try {
    const training = await prisma.training.findUniqueOrThrow({
      where: { id: req.params.id },
    });

    if (req.user.role === 'TRAINER' && training.trainerId !== req.user.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const hoursUntilStart = (new Date(training.startAt) - Date.now()) / (1000 * 60 * 60);
    if (req.user.role === 'TRAINER' && hoursUntilStart < 24) {
      return res.status(400).json({ error: 'Нельзя отменить тренировку менее чем за 24 часа до старта' });
    }

    const updated = await prisma.training.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    await notifyBookedStudents(training.id, 'SCHEDULE_CHANGE', 'Тренировка отменена', `Тренировка "${training.title}" отменена`);

    res.json(updated);
  } catch (err) { next(err); }
};

// GET /api/trainings/trainer/mine — тренировки тренера
const myTrainings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = { trainerId: req.user.id };
    if (status) where.status = status;

    const [total, trainings] = await Promise.all([
      prisma.training.count({ where }),
      prisma.training.findMany({
        where,
        include: {
          _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
        },
        orderBy: { startAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
    ]);

    res.json({ total, data: trainings });
  } catch (err) { next(err); }
};

// helper
const notifyBookedStudents = async (trainingId, type, title, body) => {
  const bookings = await prisma.booking.findMany({
    where: { trainingId, status: 'CONFIRMED' },
    select: { userId: true },
  });

  if (!bookings.length) return;

  await prisma.notification.createMany({
    data: bookings.map((b) => ({
      userId: b.userId,
      type,
      title,
      body,
    })),
  });
};

module.exports = { listTrainings, getTraining, createTraining, updateTraining, cancelTraining, myTrainings };
