import { ActionType, AdminRole, FinalStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  await prisma.manualAdjustment.deleteMany();
  await prisma.attendanceLog.deleteMany();
  await prisma.attendanceStatus.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.student.deleteMany();
  await prisma.event.deleteMany();

  const event = await prisma.event.create({
    data: {
      title: "오예스 아침 운동",
      eventDate: makeDate(0, 0),
      checkinStartAt: makeDate(7, 40),
      checkinEndAt: makeDate(7, 59),
      checkoutStartAt: makeDate(8, 20),
      checkoutEndAt: makeDate(8, 40),
      isActive: true,
    },
  });

  const admins = await prisma.$transaction([
    prisma.adminUser.create({
      data: {
        name: "운영 관리자",
        email: "admin@school.local",
        role: AdminRole.ADMIN,
        deviceLabel: "관리자 노트북",
      },
    }),
    prisma.adminUser.create({
      data: {
        name: "체육 교사",
        email: "teacher1@school.local",
        role: AdminRole.TEACHER,
        deviceLabel: "입구 A",
      },
    }),
    prisma.adminUser.create({
      data: {
        name: "담임 교사",
        email: "teacher2@school.local",
        role: AdminRole.TEACHER,
        deviceLabel: "출구 B",
      },
    }),
  ]);

  const students = await Promise.all(
    Array.from({ length: 18 }, (_, index) => {
      const seq = index + 1;
      const classNo = seq <= 9 ? 3 : 4;
      const studentNo = `2026${classNo}${String(seq).padStart(2, "0")}`;

      return prisma.student.create({
        data: {
          studentNo,
          name: `학생${String(seq).padStart(2, "0")}`,
          grade: 2,
          classNo,
          qrToken: `OY26-${classNo}-${String(seq).padStart(2, "0")}-${Math.random()
            .toString(36)
            .slice(2, 8)
            .toUpperCase()}`,
          photoUrl: `https://placehold.co/96x96?text=S${seq}`,
        },
      });
    }),
  );

  await prisma.attendanceStatus.createMany({
    data: students.map((student) => ({
      eventId: event.id,
      studentId: student.id,
      finalStatus: FinalStatus.ABSENT,
    })),
  });

  const sampleCheckins = students.slice(0, 12);
  for (const student of sampleCheckins) {
    const scannedAt = makeDate(7, 44 + (Number(student.studentNo.slice(-2)) % 10));
    await prisma.attendanceLog.create({
      data: {
        eventId: event.id,
        studentId: student.id,
        actionType: ActionType.CHECKIN,
        scannedAt,
        deviceId: "gate-a-01",
        operatorId: admins[1].id,
        isValid: true,
        rawToken: student.qrToken,
      },
    });
  }

  const sampleCheckouts = students.slice(0, 7);
  for (const student of sampleCheckouts) {
    const scannedAt = makeDate(8, 21 + (Number(student.studentNo.slice(-2)) % 8));
    await prisma.attendanceLog.create({
      data: {
        eventId: event.id,
        studentId: student.id,
        actionType: ActionType.CHECKOUT,
        scannedAt,
        deviceId: "gate-b-01",
        operatorId: admins[2].id,
        isValid: true,
        rawToken: student.qrToken,
      },
    });
  }

  await prisma.attendanceStatus.updateMany({
    where: {
      eventId: event.id,
      studentId: { in: sampleCheckins.map((student) => student.id) },
    },
    data: {
      firstCheckinAt: makeDate(7, 45),
      finalStatus: FinalStatus.MISSING_CHECKOUT,
    },
  });

  for (const student of sampleCheckouts) {
    await prisma.attendanceStatus.update({
      where: {
        eventId_studentId: {
          eventId: event.id,
          studentId: student.id,
        },
      },
      data: {
        firstCheckinAt: makeDate(7, 45),
        firstCheckoutAt: makeDate(8, 24),
        finalStatus: FinalStatus.COMPLETED,
      },
    });
  }
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
