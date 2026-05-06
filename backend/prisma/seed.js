const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Очищаем в правильном порядке
  await prisma.notification.deleteMany();
  await prisma.roomParticipant.deleteMany();
  await prisma.room.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.training.deleteMany();
  await prisma.user.deleteMany();

  // ── Пользователи ──
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@yoga.app',
      phone: '+79990000000',
      password: passwordHash,
      name: 'Администратор',
      role: 'ADMIN',
    },
  });

  const trainer1 = await prisma.user.create({
    data: {
      email: 'trainer1@yoga.app',
      password: passwordHash,
      name: 'Анна Смирнова',
      role: 'TRAINER',
      avatarUrl: 'https://i.pravatar.cc/150?img=47',
    },
  });

  const trainer2 = await prisma.user.create({
    data: {
      email: 'trainer2@yoga.app',
      password: passwordHash,
      name: 'Дмитрий Козлов',
      role: 'TRAINER',
      avatarUrl: 'https://i.pravatar.cc/150?img=12',
    },
  });

  const student1 = await prisma.user.create({
    data: {
      email: 'student1@yoga.app',
      password: passwordHash,
      name: 'Мария Петрова',
      role: 'STUDENT',
      avatarUrl: 'https://i.pravatar.cc/150?img=32',
    },
  });

  const student2 = await prisma.user.create({
    data: {
      email: 'student2@yoga.app',
      password: passwordHash,
      name: 'Игорь Новиков',
      role: 'STUDENT',
    },
  });

  const student3 = await prisma.user.create({
    data: {
      email: 'student3@yoga.app',
      password: passwordHash,
      name: 'Елена Морозова',
      role: 'STUDENT',
      avatarUrl: 'https://i.pravatar.cc/150?img=45',
    },
  });

  const student4 = await prisma.user.create({
    data: {
      email: 'student4@yoga.app',
      password: passwordHash,
      name: 'Алексей Волков',
      role: 'STUDENT',
      avatarUrl: 'https://i.pravatar.cc/150?img=56',
    },
  });

  console.log('✅ Users created');

  // ── Тренировки ──
  const now = new Date();
  const addHours = (h) => new Date(now.getTime() + h * 60 * 60 * 1000);
  const addDays = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  const trainings = await prisma.training.createMany({
    data: [
      {
        title: 'Утренняя йога для начинающих',
        description: 'Мягкий старт дня. Разогрев, базовые асаны, дыхательные практики.',
        trainerId: trainer1.id,
        direction: 'YOGA',
        level: 'BEGINNER',
        startAt: addHours(2),
        durationMin: 60,
        maxSlots: 10,
        price: 50000, // 500 руб в копейках
      },
      {
        title: 'Пилатес: укрепление кора',
        description: 'Интенсивная работа с глубокими мышцами. Коврик и мяч.',
        trainerId: trainer2.id,
        direction: 'PILATES',
        level: 'INTERMEDIATE',
        startAt: addHours(5),
        durationMin: 45,
        maxSlots: 8,
        price: 60000,
      },
      {
        title: 'Виньяса-флоу: продвинутый уровень',
        description: 'Динамическая практика йоги. Требуется опыт от 1 года.',
        trainerId: trainer1.id,
        direction: 'YOGA',
        level: 'ADVANCED',
        startAt: addDays(1),
        durationMin: 75,
        maxSlots: 6,
        price: 80000,
      },
      {
        title: 'Йога для расслабления',
        description: 'Вечерняя практика. Восстановление после рабочего дня.',
        trainerId: trainer1.id,
        direction: 'YOGA',
        level: 'BEGINNER',
        startAt: addDays(1),
        durationMin: 60,
        maxSlots: 12,
        price: 45000,
      },
      {
        title: 'Пилатес для начинающих',
        description: 'Знакомство с принципами пилатеса. Никакого инвентаря.',
        trainerId: trainer2.id,
        direction: 'PILATES',
        level: 'BEGINNER',
        startAt: addDays(2),
        durationMin: 50,
        maxSlots: 10,
        price: 50000,
      },
      {
        title: 'Бесплатное пробное занятие',
        description: 'Открытый урок для новых учеников.',
        trainerId: trainer1.id,
        direction: 'YOGA',
        level: 'BEGINNER',
        startAt: addDays(3),
        durationMin: 30,
        maxSlots: 20,
        price: 0,
      },
    ],
  });

  const allTrainings = await prisma.training.findMany({
    orderBy: { startAt: 'asc' },
  });

  console.log(`✅ ${allTrainings.length} trainings created`);

  // ── Бронирования и оплата ──
  const booking1 = await prisma.booking.create({
    data: {
      userId: student1.id,
      trainingId: allTrainings[0].id,
      status: 'CONFIRMED',
    },
  });

  await prisma.payment.create({
    data: {
      userId: student1.id,
      bookingId: booking1.id,
      amount: allTrainings[0].price,
      status: 'PAID',
      provider: 'stub',
      externalId: 'stub_seed_001',
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      userId: student2.id,
      trainingId: allTrainings[0].id,
      status: 'CONFIRMED',
    },
  });

  await prisma.payment.create({
    data: {
      userId: student2.id,
      bookingId: booking2.id,
      amount: allTrainings[0].price,
      status: 'PAID',
      provider: 'stub',
      externalId: 'stub_seed_002',
    },
  });

  const booking3 = await prisma.booking.create({
    data: {
      userId: student3.id,
      trainingId: allTrainings[0].id,
      status: 'CONFIRMED',
    },
  });

  await prisma.payment.create({
    data: {
      userId: student3.id,
      bookingId: booking3.id,
      amount: allTrainings[0].price,
      status: 'PAID',
      provider: 'stub',
      externalId: 'stub_seed_003',
    },
  });

  const booking4 = await prisma.booking.create({
    data: {
      userId: student4.id,
      trainingId: allTrainings[0].id,
      status: 'CONFIRMED',
    },
  });

  await prisma.payment.create({
    data: {
      userId: student4.id,
      bookingId: booking4.id,
      amount: allTrainings[0].price,
      status: 'PAID',
      provider: 'stub',
      externalId: 'stub_seed_004',
    },
  });

  // Бесплатная запись
  await prisma.booking.create({
    data: {
      userId: student1.id,
      trainingId: allTrainings[5].id,
      status: 'CONFIRMED',
    },
  });

  console.log('✅ Bookings & payments created');

  console.log('\n🎉 Seed complete!\n');
  console.log('Тестовые аккаунты (пароль: password123):');
  console.log(`  admin:   admin@yoga.app`);
  console.log(`  trainer: trainer1@yoga.app`);
  console.log(`  trainer: trainer2@yoga.app`);
  console.log(`  student: student1@yoga.app`);
  console.log(`  student: student2@yoga.app`);
  console.log(`  student: student3@yoga.app`);
  console.log(`  student: student4@yoga.app`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
