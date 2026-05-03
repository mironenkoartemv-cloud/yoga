const prisma = require('../config/prisma');

const expirePendingBookings = async (now = new Date()) => {
  const expired = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lte: now },
    },
    include: {
      training: { select: { title: true, startAt: true } },
    },
  });

  if (!expired.length) return { count: 0 };

  await prisma.$transaction(async (tx) => {
    await tx.booking.updateMany({
      where: { id: { in: expired.map((b) => b.id) } },
      data: { status: 'CANCELLED' },
    });

    await tx.payment.updateMany({
      where: {
        bookingId: { in: expired.map((b) => b.id) },
        status: 'PENDING',
      },
      data: { status: 'FAILED' },
    });

    await tx.notification.createMany({
      data: expired.map((booking) => ({
        userId: booking.userId,
        type: 'BOOKING_EXPIRED',
        title: 'Бронь отменена',
        body: `Время оплаты тренировки «${booking.training.title}» истекло. Место снова доступно в расписании.`,
      })),
    });
  });

  return { count: expired.length };
};

module.exports = { expirePendingBookings };
