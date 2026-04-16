const prisma = require('../config/prisma');
const paymentService = require('../services/paymentService');

// POST /api/bookings — записаться на тренировку
const createBooking = async (req, res, next) => {
  try {
    const { trainingId } = req.body;
    if (!trainingId) return res.status(400).json({ error: 'trainingId обязателен' });

    const training = await prisma.training.findUniqueOrThrow({
      where: { id: trainingId },
      include: { _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } } },
    });

    if (training.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Тренировка отменена' });
    }
    if (training.startAt < new Date()) {
      return res.status(400).json({ error: 'Тренировка уже началась или завершена' });
    }
    if (training._count.bookings >= training.maxSlots) {
      return res.status(400).json({ error: 'Нет свободных мест' });
    }

    // Бесплатная тренировка — сразу CONFIRMED
    const isPaid = training.price === 0;

    const booking = await prisma.booking.create({
      data: {
        userId: req.user.id,
        trainingId,
        status: isPaid ? 'CONFIRMED' : 'PENDING',
      },
    });

    if (!isPaid) {
      // Создаём платёж
      const payment = await paymentService.createPayment({
        bookingId: booking.id,
        userId: req.user.id,
        amount: training.price,
      });

      return res.status(201).json({ booking, payment });
    }

    res.status(201).json({ booking });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Вы уже записаны на эту тренировку' });
    }
    next(err);
  }
};

// DELETE /api/bookings/:id — отменить запись
const cancelBooking = async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { training: true, payment: true },
    });

    if (booking.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Запись уже отменена' });
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
    });

    // Если есть оплаченный платёж — возврат (заглушка)
    if (booking.payment?.status === 'PAID') {
      await paymentService.refundPayment(booking.payment.id);
    }

    res.json({ message: 'Запись отменена' });
  } catch (err) { next(err); }
};

// GET /api/bookings/my — мои бронирования
const myBookings = async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: {
        training: {
          include: {
            trainer: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        payment: { select: { status: true, amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(bookings);
  } catch (err) { next(err); }
};

// GET /api/bookings/training/:trainingId — участники тренировки (тренер)
const trainingParticipants = async (req, res, next) => {
  try {
    const training = await prisma.training.findUniqueOrThrow({
      where: { id: req.params.trainingId },
    });

    if (req.user.role === 'TRAINER' && training.trainerId !== req.user.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const bookings = await prisma.booking.findMany({
      where: { trainingId: req.params.trainingId, status: 'CONFIRMED' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    res.json(bookings);
  } catch (err) { next(err); }
};

module.exports = { createBooking, cancelBooking, myBookings, trainingParticipants };
