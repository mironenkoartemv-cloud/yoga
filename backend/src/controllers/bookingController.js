const prisma = require('../config/prisma');
const paymentService = require('../services/paymentService');
const { expirePendingBookings } = require('../services/bookingExpiryService');
const {
  getBookingExpiry,
  isPendingBookingActive,
  canCancelWithRefund,
} = require('../services/bookingPolicy');

// POST /api/bookings — записаться на тренировку
const createBooking = async (req, res, next) => {
  try {
    await expirePendingBookings();

    const { trainingId } = req.body;
    if (!trainingId) return res.status(400).json({ error: 'trainingId обязателен' });

    const training = await prisma.training.findUniqueOrThrow({
      where: { id: trainingId },
      include: { _count: { select: { bookings: { where: { status: { in: ['CONFIRMED', 'PENDING'] } } } } } },
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

    const existingBooking = await prisma.booking.findUnique({
      where: { userId_trainingId: { userId: req.user.id, trainingId } },
      include: { payment: true },
    });

    if (existingBooking && existingBooking.status === 'CONFIRMED') {
      return res.status(409).json({ error: 'Вы уже записаны на эту тренировку' });
    }
    if (isPendingBookingActive(existingBooking)) {
      return res.status(201).json({
        booking: existingBooking,
        payment: existingBooking.payment
          ? await paymentService.createPaymentLink({ paymentId: existingBooking.payment.id, userId: req.user.id })
          : null,
      });
    }

    const activePending = await prisma.booking.findFirst({
      where: {
        userId: req.user.id,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
        trainingId: { not: trainingId },
      },
      include: { training: { select: { title: true } } },
    });
    if (activePending) {
      return res.status(409).json({
        error: `У вас уже есть бронь, ожидающая оплаты: «${activePending.training.title}». Сначала оплатите или отмените её.`,
      });
    }

    const expiresAt = getBookingExpiry();

    const booking = existingBooking
      ? await prisma.booking.update({
          where: { id: existingBooking.id },
          data: { status: isPaid ? 'CONFIRMED' : 'PENDING', expiresAt: isPaid ? null : expiresAt },
        })
      : await prisma.booking.create({
          data: {
            userId: req.user.id,
            trainingId,
            status: isPaid ? 'CONFIRMED' : 'PENDING',
            expiresAt: isPaid ? null : expiresAt,
          },
        });

    if (!isPaid) {
      const activeDiscount = await prisma.userDiscount.findFirst({
        where: {
          userId: req.user.id,
          usedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { expiresAt: 'asc' },
      });
      const amount = activeDiscount
        ? Math.max(0, Math.round(training.price * (100 - activeDiscount.percent) / 100))
        : training.price;

      const payment = existingBooking?.payment
        ? await paymentService.createPaymentLink({
            paymentId: existingBooking.payment.id,
            userId: req.user.id,
          })
        : await paymentService.createPayment({
            bookingId: booking.id,
            userId: req.user.id,
            amount,
          });

      if (activeDiscount && !existingBooking?.payment) {
        await prisma.userDiscount.update({
          where: { id: activeDiscount.id },
          data: { usedAt: new Date() },
        });
      }

      await prisma.notification.create({
        data: {
          userId: req.user.id,
          type: 'BOOKING_PAYMENT_PENDING',
          title: 'Бронь ожидает оплаты',
          body: `Мы держим место на тренировку «${training.title}» до ${expiresAt.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}.`,
        },
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
    await expirePendingBookings();

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
    if (booking.status === 'CONFIRMED' && booking.training.status !== 'SCHEDULED') {
      return res.status(400).json({ error: 'Отменить можно только запланированную тренировку' });
    }
    if (booking.status === 'CONFIRMED' && booking.userId === req.user.id && req.user.role !== 'ADMIN' && !canCancelWithRefund(booking.training)) {
      return res.status(400).json({ error: 'Отменить запись можно не позднее чем за 30 минут до начала занятия' });
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
    await expirePendingBookings();

    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: {
        training: {
          include: {
            trainer: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        payment: { select: { id: true, status: true, amount: true, refundedAmount: true, provider: true, externalId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(bookings);
  } catch (err) { next(err); }
};

// GET /api/bookings/training/:trainingId — участники тренировки (тренер)
const trainingParticipants = async (req, res, next) => {
  try {
    await expirePendingBookings();

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
