const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const STUDENTS = [
  { email: 'student1@yoga.app', name: 'Мария Петрова', avatarUrl: 'https://i.pravatar.cc/150?img=32' },
  { email: 'student2@yoga.app', name: 'Игорь Новиков', avatarUrl: null },
  { email: 'student3@yoga.app', name: 'Елена Морозова', avatarUrl: 'https://i.pravatar.cc/150?img=45' },
  { email: 'student4@yoga.app', name: 'Алексей Волков', avatarUrl: 'https://i.pravatar.cc/150?img=56' },
];

async function main() {
  const password = await bcrypt.hash('password123', 10);

  for (const student of STUDENTS) {
    await prisma.user.upsert({
      where: { email: student.email },
      update: {
        name: student.name,
        role: 'STUDENT',
        isBlocked: false,
        avatarUrl: student.avatarUrl,
      },
      create: {
        ...student,
        password,
        role: 'STUDENT',
      },
    });

    console.log(`✅ ${student.email}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
