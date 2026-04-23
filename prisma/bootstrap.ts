import { prisma } from "../src/lib/prisma";

function makeDate(hour: number, minute: number) {
  const base = new Date();
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hour,
    minute,
    0,
    0,
  );
}

async function main() {
  await prisma.adminUser.upsert({
    where: { email: "admin@school.local" },
    update: {
      name: "운영 관리자",
      role: "ADMIN",
      deviceLabel: "관리자 노트북",
      isActive: true,
    },
    create: {
      name: "운영 관리자",
      email: "admin@school.local",
      role: "ADMIN",
      deviceLabel: "관리자 노트북",
      isActive: true,
    },
  });

  await prisma.adminUser.upsert({
    where: { email: "teacher1@school.local" },
    update: {
      name: "체육 교사",
      role: "TEACHER",
      deviceLabel: "입구 A",
      isActive: true,
    },
    create: {
      name: "체육 교사",
      email: "teacher1@school.local",
      role: "TEACHER",
      deviceLabel: "입구 A",
      isActive: true,
    },
  });

  await prisma.adminUser.upsert({
    where: { email: "teacher2@school.local" },
    update: {
      name: "담임 교사",
      role: "TEACHER",
      deviceLabel: "출구 B",
      isActive: true,
    },
    create: {
      name: "담임 교사",
      email: "teacher2@school.local",
      role: "TEACHER",
      deviceLabel: "출구 B",
      isActive: true,
    },
  });

  await prisma.event.upsert({
    where: {
      eventDate_title: {
        eventDate: makeDate(0, 0),
        title: "오예스 아침 운동",
      },
    },
    update: {
      checkinStartAt: makeDate(7, 40),
      checkinEndAt: makeDate(8, 0),
      checkoutStartAt: makeDate(8, 20),
      checkoutEndAt: makeDate(8, 40),
      isActive: true,
    },
    create: {
      title: "오예스 아침 운동",
      eventDate: makeDate(0, 0),
      checkinStartAt: makeDate(7, 40),
      checkinEndAt: makeDate(8, 0),
      checkoutStartAt: makeDate(8, 20),
      checkoutEndAt: makeDate(8, 40),
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
