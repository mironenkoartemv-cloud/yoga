/**
 * Payment Service
 * 
 * STUB — реализует заглушку платежей.
 * 
 * Для боевого режима заменить на реальный SDK ЮKassa:
 *   npm install @a2seven/yoo-checkout
 * 
 * Документация:
 *   https://yookassa.ru/developers/api
 *   https://github.com/a2seven/yoo-checkout
 * 
 * Нужные ключи в .env:
 *   YUKASSA_SHOP_ID=...
 *   YUKASSA_SECRET_KEY=...
 *   YUKASSA_RETURN_URL=...
 */

const prisma = require('../config/prisma');

const STUB_MODE = !process.env.YUKASSA_SHOP_ID || process.env.YUKASSA_SHOP_ID === 'STUB';

const createPayment = async ({ bookingId, userId, amount }) => {
  if (STUB_MODE) {
    // Сразу создаём платёж со статусом PENDING и фейковым confirmationUrl
    const payment = await prisma.payment.create({
      data: {
        bookingId,
        userId,
        amount,
        status: 'PENDING',
        provider: 'stub',
        externalId: `stub_${Date.now()}`,
      },
    });

    return {
      paymentId: payment.id,
      // В реальной ЮKassa здесь будет URL для редиректа пользователя
      confirmationUrl: `${process.env.YUKASSA_RETURN_URL || 'http://localhost:3000'}/payment/stub?paymentId=${payment.id}`,
      status: 'PENDING',
    };
  }

  // TODO: реальная интеграция ЮKassa
  // const { YooCheckout } = require('@a2seven/yoo-checkout');
  // const checkout = new YooCheckout({
  //   shopId: process.env.YUKASSA_SHOP_ID,
  //   secretKey: process.env.YUKASSA_SECRET_KEY,
  // });
  //
  // const idempotenceKey = require('uuid').v4();
  // const paymentData = await checkout.createPayment({
  //   amount: { value: (amount / 100).toFixed(2), currency: 'RUB' },
  //   payment_method_data: { type: 'sbp' }, // или 'bank_card'
  //   confirmation: { type: 'redirect', return_url: process.env.YUKASSA_RETURN_URL },
  //   description: `Оплата тренировки #${bookingId}`,
  // }, idempotenceKey);
  //
  // const payment = await prisma.payment.create({
  //   data: {
  //     bookingId, userId, amount,
  //     status: 'PENDING',
  //     provider: 'yukassa',
  //     externalId: paymentData.id,
  //   },
  // });
  //
  // return { paymentId: payment.id, confirmationUrl: paymentData.confirmation.confirmation_url };
};

// Webhook от ЮKassa — подтверждение оплаты
const handleWebhook = async (event) => {
  if (STUB_MODE) return;

  const { object: paymentData } = event;
  if (paymentData.status !== 'succeeded') return;

  const payment = await prisma.payment.findFirst({
    where: { externalId: paymentData.id },
  });
  if (!payment) return;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID' },
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'CONFIRMED' },
    }),
  ]);
};

// Заглушка подтверждения оплаты (только для dev)
const stubConfirmPayment = async (paymentId) => {
  if (!STUB_MODE) throw new Error('Доступно только в stub режиме');

  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'PAID' },
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'CONFIRMED' },
    }),
  ]);

  return { message: 'Платёж подтверждён (stub)' };
};

const refundPayment = async (paymentId) => {
  if (STUB_MODE) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED' },
    });
    return { message: 'Возврат выполнен (stub)' };
  }

  // TODO: реальный возврат через ЮKassa
  // checkout.createRefund({ amount: {...}, payment_id: externalId }, idempotenceKey)
};

module.exports = { createPayment, handleWebhook, stubConfirmPayment, refundPayment };
