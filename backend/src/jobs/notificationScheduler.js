const cron = require('node-cron');
const prisma = require('../config/prisma');
const pushService = require('../services/pushService');

/**
 * Планировщик уведомлений
 *
 * Запускается каждую минуту и проверяет:
 *   - тренировки через ~1 час → REMINDER_1H
 *   - тренировки через ~10 минут → REMINDER_10M
 */

const startScheduler = () => {
  // Каждую минуту
  cron.schedule('* * * * *', async () => {
    try {
      await sendReminders(60, 'REMINDER_1H', 'Тренировка через 1 час', (t) =>
        `«${t.title}» начнётся в ${formatTime(t.startAt)}`
      );

      await sendReminders(10, 'REMINDER_10M', 'Тренировка через 10 минут', (t) =>
        `«${t.title}» начинается совсем скоро!`
      );
    } catch (err) {
      console.error('[Scheduler] Error:', err);
    }
  });

  console.log('[Scheduler] Notification scheduler started');
};

const sendReminders = async (minutesBefore, type, title, bodyFn) => {
  const now = new Date();
  const windowStart = new Date(now.getTime() + (minutesBefore - 1) * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (minutesBefore + 1) * 60 * 1000);

  const trainings = await prisma.training.findMany({
    where: {
      status: 'SCHEDULED',
      startAt: { gte: windowStart, lte: windowEnd },
    },
    include: {
      bookings: {
        where: { status: 'CONFIRMED' },
        select: { userId: true },
      },
    },
  });

  for (const training of trainings) {
    if (!training.bookings.length) continue;

    const body = bodyFn(training);
    const userIds = training.bookings.map((b) => b.userId);

    // Проверяем, не отправляли ли уже это уведомление
    const existing = await prisma.notification.findFirst({
      where: {
        type,
        body,
        userId: { in: userIds },
        sentAt: { gte: new Date(now.getTime() - 5 * 60 * 1000) },
      },
    });
    if (existing) continue;

    // Создаём уведомления в БД
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, type, title, body })),
      skipDuplicates: true,
    });

    // Отправляем push (заглушка)
    for (const userId of userIds) {
      await pushService.sendPush(userId, title, body);
    }
  }
};

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
};

module.exports = { startScheduler };
