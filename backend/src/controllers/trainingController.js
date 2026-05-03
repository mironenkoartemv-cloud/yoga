const prisma = require('../config/prisma');
const { validationResult } = require('express-validator');
const { expirePendingBookings } = require('../services/bookingExpiryService');

// GET /api/trainings — каталог с фильтрами
const listTrainings = async (req, res, next) => {
  try {
    await expirePendingBookings();

    const { direction, level, trainerId, from, to, page = 1, limit = 20 } = req.query;

    const where = {
      status: { not: 'CANCELLED' },
    };
    if (direction) where.direction = direction;
    if (level) where.level = level;
    if (trainerId) where.trainerId = trainerId;
    if (from || to) {
      where.startAt = {};
      if (from) where.startAt.gte = new Date(from);
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

    const training = await prisma.training.create({
      data: {
        title,
        description,
        trainerId: req.user.id,
        direction,
        level,
        startAt: new Date(startAt),
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
      // Тренер может менять только время
      if (req.body.startAt !== undefined) {
        const newStartAt = new Date(req.body.startAt);
        const hoursUntilNewStart = (newStartAt - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilNewStart < 12) {
          return res.status(400).json({ error: 'Новое время тренировки должно быть не менее чем через 12 часов' });
        }
        data.startAt = newStartAt;
      }
      // Описание — заявка на модерацию
      if (req.body.description !== undefined) {
        await prisma.moderationRequest.create({
          data: {
            trainingId: req.params.id,
            trainerId:  req.user.id,
            field:      'description',
            newValue:   req.body.description,
          },
        });
        return res.status(202).json({
          message: 'Заявка на изменение описания отправлена на модерацию',
          pending: true,
        });
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
