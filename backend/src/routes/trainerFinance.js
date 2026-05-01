const router = require('express').Router();
const prisma = require('../config/prisma');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/trainer/finance — финансовая статистика тренера
router.get('/finance', authenticate, requireRole('TRAINER', 'ADMIN'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const trainerId = req.user.id;

    const where = {
      status: 'PAID',
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        },
      } : {}),
      booking: {
        training: {
          trainerId,
        },
      },
    };

    const payments = await prisma.payment.findMany({
      where,
      include: {
        booking: {
          include: {
            training: {
              select: { id: true, title: true, startAt: true, direction: true },
            },
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Агрегация по дням для графика
    const byDay = {};
    payments.forEach(p => {
      const day = new Date(p.createdAt).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { date: day, amount: 0, count: 0 };
      byDay[day].amount += p.amount;
      byDay[day].count++;
    });

    const dailyData = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

    // Агрегация по тренировкам
    const byTraining = {};
    payments.forEach(p => {
      const tid = p.booking.training.id;
      if (!byTraining[tid]) byTraining[tid] = {
        id: tid,
        title: p.booking.training.title,
        date: p.booking.training.startAt,
        amount: 0,
        count: 0,
      };
      byTraining[tid].amount += p.amount;
      byTraining[tid].count++;
    });

    const totalAmount   = payments.reduce((s, p) => s + p.amount, 0);
    const totalCount    = payments.length;
    const avgCheck      = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;
    const avgPerTraining = Object.keys(byTraining).length > 0
      ? Math.round(totalAmount / Object.keys(byTraining).length) : 0;

    // Средний доход в день (только дни с тренировками)
    const activeDays    = Object.keys(byDay).length;
    const avgPerDay     = activeDays > 0 ? Math.round(totalAmount / activeDays) : 0;

    res.json({
      totalAmount,
      totalCount,
      avgCheck,
      avgPerTraining,
      avgPerDay,
      dailyData,
      byTraining: Object.values(byTraining).sort((a, b) => new Date(b.date) - new Date(a.date)),
      payments: payments.map(p => ({
        id: p.id,
        amount: p.amount,
        date: p.createdAt,
        trainingDate: p.booking.training.startAt,
        trainingTitle: p.booking.training.title,
        studentName: p.booking.user.name,
      })),
    });
  } catch (err) { next(err); }
});

module.exports = router;
