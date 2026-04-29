const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding admin test data...')

  // Найдём существующих пользователей и тренировки
  const admin    = await prisma.user.findUnique({ where: { email: 'admin@yoga.app' } })
  const trainer1 = await prisma.user.findUnique({ where: { email: 'trainer1@yoga.app' } })
  const trainer2 = await prisma.user.findUnique({ where: { email: 'trainer2@yoga.app' } })
  const student1 = await prisma.user.findUnique({ where: { email: 'student1@yoga.app' } })
  const student2 = await prisma.user.findUnique({ where: { email: 'student2@yoga.app' } })

  if (admin && !admin.phone) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { phone: '+79990000000' }
    })
    console.log('✅ Admin phone added: +79990000000')
  }

  // Найдём запланированную тренировку тренера
  const scheduledTraining = await prisma.training.findFirst({
    where: { trainerId: trainer1.id, status: 'SCHEDULED' }
  })

  if (!scheduledTraining) {
    console.log('❌ Нет запланированных тренировок — создайте через + Тренировка в UI')
    await prisma.$disconnect()
    return
  }

  console.log(`✅ Используем тренировку: ${scheduledTraining.title}`)

  // ── 1. Добавить заявку на модерацию описания ──────────
  await prisma.moderationRequest.createMany({
    data: [
      {
        trainingId: scheduledTraining.id,
        trainerId:  trainer1.id,
        field:      'description',
        newValue:   'Новое описание тренировки — глубокая практика йоги для восстановления тела и духа. Включает пранаяму и медитацию.',
        status:     'PENDING',
      },
      {
        trainingId: scheduledTraining.id,
        trainerId:  trainer1.id,
        field:      'description',
        newValue:   'Старая заявка которую уже одобрили.',
        status:     'APPROVED',
        reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        reviewNote: 'Хорошее описание, одобрено',
      },
      {
        trainingId: scheduledTraining.id,
        trainerId:  trainer1.id,
        field:      'description',
        newValue:   'Слишком короткое.',
        status:     'REJECTED',
        reviewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        reviewNote: 'Описание слишком короткое, добавьте больше деталей',
      },
    ],
    skipDuplicates: true,
  })
  console.log('✅ Moderation requests created')

  // ── 2. Добавить ещё платежей для финансов ────────────
  // Найдём незаписанных учеников
  const student3 = await prisma.user.findUnique({ where: { email: 'student3@yoga.app' } })

  if (student3) {
    // Проверим нет ли уже записи
    const existingBooking = await prisma.booking.findFirst({
      where: { userId: student3.id, trainingId: scheduledTraining.id }
    })

    if (!existingBooking) {
      const booking = await prisma.booking.create({
        data: {
          userId:     student3.id,
          trainingId: scheduledTraining.id,
          status:     'CONFIRMED',
        }
      })
      await prisma.payment.create({
        data: {
          userId:     student3.id,
          bookingId:  booking.id,
          amount:     scheduledTraining.price,
          status:     'PAID',
          provider:   'stub',
          externalId: `stub_admin_test_${Date.now()}`,
        }
      })
      console.log('✅ Extra payment created for student3')
    }
  }

  // ── 3. Заблокировать одного пользователя для теста ───
  if (student2) {
    await prisma.user.update({
      where: { id: student2.id },
      data: { isBlocked: true }
    })
    console.log('✅ student2 blocked for testing')
  }

  console.log('\n🎉 Admin test data ready!')
  console.log('\nПроверьте в админке:')
  console.log('  📊 Дашборд — статистика')
  console.log('  👥 Пользователи — student2 заблокирован')
  console.log('  💳 Платежи — новые платежи')
  console.log('  ✏️  Модерация — 3 заявки (1 pending, 1 approved, 1 rejected)')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
