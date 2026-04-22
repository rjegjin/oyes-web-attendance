import { ActionType, FinalStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isWithinWindow } from "@/lib/time";

export const DEFAULT_OPERATOR_EMAIL = "teacher1@school.local";

export type ScanAction = "checkin" | "checkout";

export function mapActionToEnum(action: ScanAction, manual = false) {
  if (action === "checkin") {
    return manual ? ActionType.MANUAL_CHECKIN : ActionType.CHECKIN;
  }

  return manual ? ActionType.MANUAL_CHECKOUT : ActionType.CHECKOUT;
}

export async function getTodayEvent() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return prisma.event.findFirst({
    where: {
      eventDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      isActive: true,
    },
  });
}

function computeFinalStatus(firstCheckinAt: Date | null, firstCheckoutAt: Date | null, manual = false) {
  if (firstCheckinAt && firstCheckoutAt) {
    return manual ? FinalStatus.MANUAL_COMPLETED : FinalStatus.COMPLETED;
  }

  if (firstCheckinAt) {
    return FinalStatus.MISSING_CHECKOUT;
  }

  if (firstCheckoutAt) {
    return FinalStatus.CHECKOUT_ONLY;
  }

  return FinalStatus.ABSENT;
}

export async function updateAttendanceStatus(
  tx: Prisma.TransactionClient,
  eventId: string,
  studentId: string,
  action: ScanAction,
  scannedAt: Date,
  manual = false,
) {
  const existing = await tx.attendanceStatus.upsert({
    where: {
      eventId_studentId: {
        eventId,
        studentId,
      },
    },
    create: {
      eventId,
      studentId,
      finalStatus: FinalStatus.PENDING,
    },
    update: {},
  });

  const nextCheckinAt =
    action === "checkin" && !existing.firstCheckinAt ? scannedAt : existing.firstCheckinAt;
  const nextCheckoutAt =
    action === "checkout" && !existing.firstCheckoutAt ? scannedAt : existing.firstCheckoutAt;

  return tx.attendanceStatus.update({
    where: {
      eventId_studentId: {
        eventId,
        studentId,
      },
    },
    data: {
      firstCheckinAt: nextCheckinAt,
      firstCheckoutAt: nextCheckoutAt,
      finalStatus: computeFinalStatus(nextCheckinAt, nextCheckoutAt, manual),
    },
  });
}

export async function processScan({
  action,
  token,
  deviceId,
  operatorEmail = DEFAULT_OPERATOR_EMAIL,
  manual = false,
  reason,
}: {
  action: ScanAction;
  token: string;
  deviceId: string;
  operatorEmail?: string;
  manual?: boolean;
  reason?: string;
}) {
  const normalizedToken = token.trim();
  const event = await getTodayEvent();

  if (!event) {
    throw new Error("오늘 활성화된 행사가 없습니다.");
  }

  const operator = await prisma.adminUser.findUnique({
    where: { email: operatorEmail },
  });

  if (!operator) {
    throw new Error("운영자 계정을 찾을 수 없습니다.");
  }

  const student = await prisma.student.findFirst({
    where: {
      OR: [{ qrToken: normalizedToken }, { studentNo: normalizedToken }],
      isActive: true,
    },
  });

  const scannedAt = new Date();
  const type = mapActionToEnum(action, manual);

  if (!student) {
    await prisma.attendanceLog.create({
      data: {
        eventId: event.id,
        actionType: type,
        scannedAt,
        deviceId,
        operatorId: operator.id,
        isValid: false,
        invalidReason: "unknown-token",
        rawToken: normalizedToken,
      },
    });

    return {
      ok: false,
      code: "UNKNOWN_TOKEN",
      message: "등록되지 않은 학생 또는 QR 토큰입니다.",
    };
  }

  const timeValid =
    manual ||
    (action === "checkin"
      ? isWithinWindow(scannedAt, event.checkinStartAt, event.checkinEndAt)
      : isWithinWindow(scannedAt, event.checkoutStartAt, event.checkoutEndAt));

  if (!timeValid) {
    await prisma.attendanceLog.create({
      data: {
        eventId: event.id,
        studentId: student.id,
        actionType: type,
        scannedAt,
        deviceId,
        operatorId: operator.id,
        isValid: false,
        invalidReason: "outside-window",
        rawToken: normalizedToken,
      },
    });

    return {
      ok: false,
      code: "OUTSIDE_WINDOW",
      message:
        action === "checkin"
          ? "체크인 가능 시간이 아닙니다."
          : "체크아웃 가능 시간이 아닙니다.",
      student,
    };
  }

  const status = await prisma.attendanceStatus.findUnique({
    where: {
      eventId_studentId: {
        eventId: event.id,
        studentId: student.id,
      },
    },
  });

  const duplicate =
    (action === "checkin" && status?.firstCheckinAt) ||
    (action === "checkout" && status?.firstCheckoutAt);

  if (duplicate) {
    await prisma.attendanceLog.create({
      data: {
        eventId: event.id,
        studentId: student.id,
        actionType: type,
        scannedAt,
        deviceId,
        operatorId: operator.id,
        isValid: false,
        invalidReason: "duplicate",
        rawToken: normalizedToken,
      },
    });

    return {
      ok: false,
      code: "DUPLICATE",
      message:
        action === "checkin"
          ? "이미 체크인된 학생입니다."
          : "이미 체크아웃된 학생입니다.",
      student,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const log = await tx.attendanceLog.create({
      data: {
        eventId: event.id,
        studentId: student.id,
        actionType: type,
        scannedAt,
        deviceId,
        operatorId: operator.id,
        isValid: true,
        rawToken: normalizedToken,
      },
    });

    const updatedStatus = await updateAttendanceStatus(tx, event.id, student.id, action, scannedAt, manual);

    if (manual && reason) {
      await tx.manualAdjustment.create({
        data: {
          eventId: event.id,
          studentId: student.id,
          actionType: type,
          reason,
          operatorId: operator.id,
        },
      });
    }

    return { log, updatedStatus };
  });

  return {
    ok: true,
    code: "ACCEPTED",
    message: manual
      ? `${action === "checkin" ? "수동 체크인" : "수동 체크아웃"} 처리 완료`
      : `${action === "checkin" ? "체크인" : "체크아웃"} 완료`,
    student,
    scannedAt,
    finalStatus: result.updatedStatus.finalStatus,
  };
}

export async function getDashboardSnapshot() {
  const event = await getTodayEvent();

  if (!event) {
    return null;
  }

  // 1. 활성 학생 목록과 현재 이벤트의 상태 목록을 가져옵니다.
  const students = await prisma.student.findMany({
    where: { isActive: true },
    orderBy: [{ grade: "asc" }, { classNo: "asc" }, { name: "asc" }],
  });
  
  const existingStatuses = await prisma.attendanceStatus.findMany({
    where: { eventId: event.id },
    select: { studentId: true },
  });

  // 2. 누락된 상태 레코드가 있다면 ABSENT로 자동 초기화합니다.
  const existingIds = new Set(existingStatuses.map((s) => s.studentId));
  const missingStudents = students.filter((s) => !existingIds.has(s.id));

  if (missingStudents.length > 0) {
    await prisma.attendanceStatus.createMany({
      data: missingStudents.map((s) => ({
        eventId: event.id,
        studentId: s.id,
        finalStatus: FinalStatus.ABSENT,
      })),
    });
  }

  const [statuses, recentLogs] = await Promise.all([
    prisma.attendanceStatus.findMany({
      where: { eventId: event.id },
      include: { student: true },
      orderBy: [{ student: { classNo: "asc" } }, { student: { name: "asc" } }],
    }),
    prisma.attendanceLog.findMany({
      where: { eventId: event.id },
      include: { student: true, operator: true },
      orderBy: { scannedAt: "desc" },
      take: 10,
    }),
  ]);

  const metrics = {
    targetCount: students.length,
    checkinCount: statuses.filter((item) => item.firstCheckinAt).length,
    checkoutCount: statuses.filter((item) => item.firstCheckoutAt).length,
    completedCount: statuses.filter((item) =>
      item.finalStatus === FinalStatus.COMPLETED || item.finalStatus === FinalStatus.MANUAL_COMPLETED
    ).length,
    missingCheckinCount: statuses.filter((item) =>
      item.finalStatus === FinalStatus.ABSENT || item.finalStatus === FinalStatus.CHECKOUT_ONLY || item.finalStatus === FinalStatus.MISSING_CHECKIN
    ).length,
    missingCheckoutCount: statuses.filter((item) => item.finalStatus === FinalStatus.MISSING_CHECKOUT).length,
  };

  return { event, students, statuses, recentLogs, metrics };
}
