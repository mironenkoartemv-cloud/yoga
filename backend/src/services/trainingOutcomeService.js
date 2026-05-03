const prisma = require('../config/prisma');
const paymentService = require('./paymentService');
const {
  POST_TRAINING_DISCOUNT_MIN,
  POST_TRAINING_DISCOUNT_PERCENT,
  shouldRefundFully,
} = require('./roomPolicy');

const APOLOGY_REASONS = ['TRAINER_NO_SHOW', 'TRAINER_DISCONNECT', 'PLATFORM_ISSUE'];
const REACTIVATION_REASON = 'NORMAL_FINISH';

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

const hasFutureBooking = async (userId, excludeTrainingId) => {
  const booking = await prisma.booking.findFirst({
    where: {
      userId,
      trainingId: { not: excludeTrainingId },
      status: 'CONFIRMED',
      training: {
        status: { in: ['SCHEDULED', 'LIVE'] },
        startAt: { gt: new Date() },
      },
    },
    select: { id: true },
  });

  return Boolean(booking);
};

const hasActiveApologyDiscount = async (userId) => {
  const discount = await prisma.userDiscount.findFirst({
    where: {
      userId,
      usedAt: null,
      reason: { in: APOLOGY_REASONS },
    },
  });
  return Boolean(discount);
};

const grantPostTrainingDiscount = async ({ userId, trainingId, reason, onlyWithoutFutureBookings = false }) => {
  if (onlyWithoutFutureBookings && await hasFutureBooking(userId, trainingId)) return null;

  const isApology = APOLOGY_REASONS.includes(reason);
  const isReactivation = reason === REACTIVATION_REASON;

  if (isReactivation && await hasActiveApologyDiscount(userId)) return null;

  const existing = await prisma.userDiscount.findFirst({
    where: { userId, usedAt: null },
  });

  const expiresAt = isApology ? null : addMinutes(new Date(), POST_TRAINING_DISCOUNT_MIN);

  if (existing) {
    if (!isApology && APOLOGY_REASONS.includes(existing.reason)) return existing;

    return prisma.userDiscount.update({
      where: { id: existing.id },
      data: {
        percent: POST_TRAINING_DISCOUNT_PERCENT,
        reason,
        sourceTrainingId: trainingId,
        expiresAt,
      },
    });
  }

  return prisma.userDiscount.create({
    data: {
      userId,
      percent: POST_TRAINING_DISCOUNT_PERCENT,
      reason,
      sourceTrainingId: trainingId,
      expiresAt,
    },
  });
};

const getConfirmedBookings = (trainingId) => prisma.booking.findMany({
  where: { trainingId, status: 'CONFIRMED' },
  include: { payment: true },
});

const refundBookingPayment = async ({ booking, percent = 100 }) => {
  if (!booking.payment || booking.payment.status !== 'PAID') return null;
  const amount = Math.round((booking.payment.amount * percent) / 100);
  if (amount <= 0) return null;
  return paymentService.refundPayment(booking.payment.id, { amount });
};

const cancelBeforeStartByTrainer = async (trainingId) => {
  const training = await prisma.training.findUniqueOrThrow({ where: { id: trainingId } });
  const bookings = await getConfirmedBookings(trainingId);

  await Promise.all(bookings.map(async (booking) => {
    await refundBookingPayment({ booking, percent: 100 });
    await grantPostTrainingDiscount({
      userId: booking.userId,
      trainingId,
      reason: 'TRAINER_NO_SHOW',
      onlyWithoutFutureBookings: false,
    });
  }));

  await prisma.training.update({
    where: { id: trainingId },
    data: { status: 'CANCELLED' },
  });

  await notifyUsers(bookings.map((b) => b.userId), {
    type: 'TRAINER_NO_SHOW',
    title: 'Тренировка не началась',
    body: 'Тренер не смог начать занятие вовремя. Мы вернём оплату полностью и дали скидку 10% на любую следующую тренировку.',
  });

  return { training, bookingsCount: bookings.length };
};

const failDuringClassByTrainerDisconnect = async (trainingId, failedAt = new Date()) => {
  const training = await prisma.training.findUniqueOrThrow({ where: { id: trainingId } });
  const bookings = await getConfirmedBookings(trainingId);
  const refundPercent = shouldRefundFully(training, failedAt) ? 100 : 50;

  await Promise.all(bookings.map(async (booking) => {
    await refundBookingPayment({ booking, percent: refundPercent });
    await grantPostTrainingDiscount({
      userId: booking.userId,
      trainingId,
      reason: 'TRAINER_DISCONNECT',
      onlyWithoutFutureBookings: false,
    });
  }));

  await prisma.training.update({
    where: { id: trainingId },
    data: { status: 'FINISHED' },
  });

  await notifyUsers(bookings.map((b) => b.userId), {
    type: 'TRAINER_DISCONNECT',
    title: 'Тренировка прервалась',
    body: `Мы отправили на возврат ${refundPercent}% оплаты и сохранили скидку 10% на любую новую запись.`,
  });

  return { training, bookingsCount: bookings.length, refundPercent };
};

const finishNormally = async (trainingId) => {
  const bookings = await getConfirmedBookings(trainingId);

  await prisma.training.update({
    where: { id: trainingId },
    data: { status: 'FINISHED' },
  });

  await Promise.all(bookings.map((booking) => grantPostTrainingDiscount({
    userId: booking.userId,
    trainingId,
    reason: 'NORMAL_FINISH',
    onlyWithoutFutureBookings: true,
  })));

  return { bookingsCount: bookings.length };
};

const notifyUsers = async (userIds, { type, title, body }) => {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  if (!uniqueIds.length) return;

  await prisma.notification.createMany({
    data: uniqueIds.map((userId) => ({ userId, type, title, body })),
  });
};

module.exports = {
  APOLOGY_REASONS,
  REACTIVATION_REASON,
  hasActiveApologyDiscount,
  grantPostTrainingDiscount,
  cancelBeforeStartByTrainer,
  failDuringClassByTrainerDisconnect,
  finishNormally,
};
