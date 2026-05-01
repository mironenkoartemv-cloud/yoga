/**
 * Payment Service
 *
 * T-Bank internet acquiring integration. In production the app creates a
 * payment through /v2/Init, stores T-Bank PaymentId in Payment.externalId and
 * confirms bookings from T-Bank webhooks.
 */

const crypto = require('crypto');
const axios = require('axios');
const prisma = require('../config/prisma');

const TBANK_API_URL = process.env.TBANK_API_URL || 'https://securepay.tinkoff.ru/v2';
const TBANK_TERMINAL_KEY = process.env.TBANK_TERMINAL_KEY;
const TBANK_PASSWORD = process.env.TBANK_PASSWORD;
const STUB_MODE = !TBANK_TERMINAL_KEY || !TBANK_PASSWORD || TBANK_TERMINAL_KEY === 'STUB';

const getFrontendUrl = () => process.env.FRONTEND_URL || process.env.TBANK_SUCCESS_URL?.replace('/payment/success', '') || 'http://localhost:5173';

const makeToken = (payload) => {
  if (!TBANK_PASSWORD) throw new Error('TBANK_PASSWORD не настроен');

  const tokenPayload = {
    ...Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
    ),
    Password: TBANK_PASSWORD,
  };

  delete tokenPayload.Token;

  const values = Object.keys(tokenPayload)
    .sort()
    .map((key) => String(tokenPayload[key]))
    .join('');

  return crypto.createHash('sha256').update(values, 'utf8').digest('hex');
};

const assertTbankSuccess = (data, fallbackMessage) => {
  if (data?.Success) return;
  const details = [data?.Message, data?.Details, data?.ErrorCode].filter(Boolean).join(' ');
  throw new Error(details || fallbackMessage);
};

const getPaymentReturnUrls = () => {
  const frontendUrl = getFrontendUrl();

  return {
    successUrl: process.env.TBANK_SUCCESS_URL || `${frontendUrl}/payment/success`,
    failUrl: process.env.TBANK_FAIL_URL || `${frontendUrl}/payment/fail`,
    notificationUrl: process.env.TBANK_NOTIFICATION_URL,
  };
};

const makeTbankOrderId = (bookingId) => {
  const compactBookingId = bookingId.replace(/-/g, '').slice(0, 20);
  const uniqueSuffix = Date.now().toString(36);
  return `${compactBookingId}${uniqueSuffix}`;
};

const withPaymentIdParam = (url, paymentId) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}paymentId=${encodeURIComponent(paymentId)}`;
};

const initTbankPayment = async ({ bookingId, localPaymentId, amount }) => {
  const { successUrl, failUrl, notificationUrl } = getPaymentReturnUrls();
  if (!notificationUrl) throw new Error('TBANK_NOTIFICATION_URL не настроен');

  const payload = {
    TerminalKey: TBANK_TERMINAL_KEY,
    Amount: amount,
    OrderId: makeTbankOrderId(bookingId),
    Description: `Оплата тренировки #${bookingId}`,
    PayType: 'O',
    SuccessURL: withPaymentIdParam(successUrl, localPaymentId),
    FailURL: withPaymentIdParam(failUrl, localPaymentId),
    NotificationURL: notificationUrl,
  };

  payload.Token = makeToken(payload);

  const { data } = await axios.post(`${TBANK_API_URL}/Init`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });

  assertTbankSuccess(data, 'Не удалось создать платеж в Т-Банке');
  if (!data.PaymentURL || !data.PaymentId) {
    throw new Error('Т-Банк не вернул ссылку на оплату');
  }

  return data;
};

const createPayment = async ({ bookingId, userId, amount }) => {
  if (STUB_MODE) {
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
      confirmationUrl: `${getFrontendUrl()}/payment/success?paymentId=${payment.id}&stub=1`,
      status: 'PENDING',
    };
  }

  const payment = await prisma.payment.create({
    data: {
      bookingId,
      userId,
      amount,
      status: 'PENDING',
      provider: 'tbank',
    },
  });

  const data = await initTbankPayment({ bookingId, localPaymentId: payment.id, amount });
  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: { externalId: String(data.PaymentId) },
  });

  return {
    paymentId: updatedPayment.id,
    providerPaymentId: String(data.PaymentId),
    confirmationUrl: data.PaymentURL,
    status: updatedPayment.status,
  };
};

const createPaymentLink = async ({ paymentId, userId, isAdmin = false }) => {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { booking: true },
  });

  if (payment.userId !== userId && !isAdmin) {
    const error = new Error('Нет доступа');
    error.status = 403;
    throw error;
  }

  if (payment.status === 'PAID') {
    const error = new Error('Платеж уже оплачен');
    error.status = 400;
    throw error;
  }

  if (payment.booking.status === 'CANCELLED') {
    const error = new Error('Запись отменена');
    error.status = 400;
    throw error;
  }

  if (STUB_MODE) {
    return {
      paymentId: payment.id,
      confirmationUrl: `${getFrontendUrl()}/payment/success?paymentId=${payment.id}&stub=1`,
      status: payment.status,
    };
  }

  const data = await initTbankPayment({
    bookingId: payment.bookingId,
    localPaymentId: payment.id,
    amount: payment.amount,
  });
  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      provider: 'tbank',
      externalId: String(data.PaymentId),
      status: 'PENDING',
    },
  });

  return {
    paymentId: updatedPayment.id,
    providerPaymentId: String(data.PaymentId),
    confirmationUrl: data.PaymentURL,
    status: updatedPayment.status,
  };
};

const verifyTbankToken = (payload) => {
  if (STUB_MODE) return true;
  return payload?.Token && payload.Token === makeToken(payload);
};

const getPaymentStatus = async (paymentId) => {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  return payment;
};

const markPaymentPaid = async (payment) => {
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

const markPaymentRefunded = async (payment) => {
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED' },
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'CANCELLED' },
    }),
  ]);
};

const syncPaymentStatus = async (paymentId) => {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

  if (STUB_MODE || payment.provider !== 'tbank' || !payment.externalId) {
    return payment;
  }

  const payload = {
    TerminalKey: TBANK_TERMINAL_KEY,
    PaymentId: payment.externalId,
  };
  payload.Token = makeToken(payload);

  const { data } = await axios.post(`${TBANK_API_URL}/GetState`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });

  assertTbankSuccess(data, 'Не удалось получить статус платежа в Т-Банке');

  if (data.Status === 'CONFIRMED') {
    await markPaymentPaid(payment);
    return prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  }

  if (['REFUNDED', 'PARTIAL_REFUNDED', 'REVERSED', 'PARTIAL_REVERSED'].includes(data.Status)) {
    await markPaymentRefunded(payment);
    return prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  }

  if (['REJECTED', 'DEADLINE_EXPIRED', 'AUTH_FAIL'].includes(data.Status)) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED' },
    });
  }

  return payment;
};

const handleWebhook = async (event) => {
  if (STUB_MODE) return;
  if (!verifyTbankToken(event)) {
    const error = new Error('Некорректная подпись webhook Т-Банка');
    error.status = 401;
    throw error;
  }

  const payment = await prisma.payment.findFirst({
    where: { externalId: String(event.PaymentId), provider: 'tbank' },
  });
  if (!payment) return;

  if (event.Status === 'CONFIRMED') {
    await markPaymentPaid(payment);
    return;
  }

  if (['REJECTED', 'DEADLINE_EXPIRED'].includes(event.Status)) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });
  }

  if (['REFUNDED', 'PARTIAL_REFUNDED', 'REVERSED', 'PARTIAL_REVERSED'].includes(event.Status)) {
    await markPaymentRefunded(payment);
  }
};

const stubConfirmPayment = async (paymentId) => {
  if (!STUB_MODE) throw new Error('Доступно только в stub режиме');

  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await markPaymentPaid(payment);

  return { message: 'Платеж подтвержден (stub)' };
};

const refundPayment = async (paymentId) => {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

  if (STUB_MODE || payment.provider !== 'tbank') {
    await markPaymentRefunded(payment);
    return { message: 'Возврат выполнен (stub)' };
  }

  const payload = {
    TerminalKey: TBANK_TERMINAL_KEY,
    PaymentId: payment.externalId,
    Amount: payment.amount,
  };
  payload.Token = makeToken(payload);

  const { data } = await axios.post(`${TBANK_API_URL}/Cancel`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });

  assertTbankSuccess(data, 'Не удалось выполнить возврат в Т-Банке');

  await markPaymentRefunded(payment);

  return { message: 'Возврат выполнен' };
};

module.exports = {
  createPayment,
  createPaymentLink,
  getPaymentStatus,
  syncPaymentStatus,
  handleWebhook,
  stubConfirmPayment,
  refundPayment,
};
