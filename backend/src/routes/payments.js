const router = require('express').Router();
const prisma = require('../config/prisma');
const paymentService = require('../services/paymentService');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/payments/my
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      include: {
        booking: {
          include: { training: { select: { id: true, title: true, startAt: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch (err) { next(err); }
});

// GET /api/payments/:id — статус платежа
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentStatus(req.params.id);
    if (payment.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    res.json(payment);
  } catch (err) { next(err); }
});

// POST /api/payments/:id/link — создать новую ссылку на оплату
router.post('/:id/link', authenticate, async (req, res, next) => {
  try {
    const result = await paymentService.createPaymentLink({
      paymentId: req.params.id,
      userId: req.user.id,
      isAdmin: req.user.role === 'ADMIN',
    });
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/payments/webhook — вебхук от Т-Банка
router.post('/webhook', async (req, res, next) => {
  try {
    await paymentService.handleWebhook(req.body);
    res.send('OK');
  } catch (err) { next(err); }
});

// POST /api/payments/stub-confirm — только dev, подтвердить оплату
router.post('/stub-confirm', authenticate, async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }
    const { paymentId } = req.body;
    const result = await paymentService.stubConfirmPayment(paymentId);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/payments/:id/refund — возврат (только админ)
router.post('/:id/refund', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const result = await paymentService.refundPayment(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
