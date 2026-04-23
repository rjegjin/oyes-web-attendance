import { Prisma } from "@prisma/client";
import type { DashboardFilters } from "@/lib/attendance-report";

export const ActionType = {
  CHECKIN: "CHECKIN",
  CHECKOUT: "CHECKOUT",
  MANUAL_CHECKIN: "MANUAL_CHECKIN",
  MANUAL_CHECKOUT: "MANUAL_CHECKOUT",
} as const;
export type ActionType = typeof ActionType[keyof typeof ActionType];

export const AdminRole = {
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
} as const;
export type AdminRole = typeof AdminRole[keyof typeof AdminRole];

export const FinalStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  MISSING_CHECKIN: "MISSING_CHECKIN",
  MISSING_CHECKOUT: "MISSING_CHECKOUT",
  CHECKOUT_ONLY: "CHECKOUT_ONLY",
  ABSENT: "ABSENT",
  MANUAL_COMPLETED: "MANUAL_COMPLETED",
} as const;
export type FinalStatus = typeof FinalStatus[keyof typeof FinalStatus];
import { prisma } from "@/lib/prisma";
import { isWithinWindow } from "@/lib/time";

export const DEFAULT_OPERATOR_EMAIL = "teacher1@school.local";
export const OPERATOR_DEVICE_RULES: Record<string, string[]> = {
  "teacher1@school.local": ["gate-a-01"],
  "teacher2@school.local": ["gate-b-01"],
  "admin@school.local": ["manual-desk-01"],
};

export type ScanAction = "checkin" | "checkout";
export type OperationFilters = {
  q?: string;
  classNo?: string;
  validity?: string;
  actionType?: string;
};

export function mapActionToEnum(action: ScanAction, manual = false) {
  if (action === "checkin") {
    return manual ? ActionType.MANUAL_CHECKIN : ActionType.CHECKIN;
  }

  return manual ? ActionType.MANUAL_CHECKOUT : ActionType.CHECKOUT;
}

export async function getTodayEvent() {
  return prisma.event.findFirst({
    where: {
      isActive: true,
    },
    orderBy: {
      eventDate: "desc",
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
  capturedAt,
  manual = false,
  reason,
}: {
  action: ScanAction;
  token: string;
  deviceId: string;
  operatorEmail?: string;
  capturedAt?: Date;
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

  if (!operator || !operator.isActive) {
    throw new Error("운영자 계정을 찾을 수 없습니다.");
  }

  if (manual && operator.role !== AdminRole.ADMIN) {
    throw new Error("수동 처리 권한이 없는 운영자입니다.");
  }

  const allowedDeviceIds = OPERATOR_DEVICE_RULES[operator.email] ?? [];
  if (allowedDeviceIds.length > 0 && !allowedDeviceIds.includes(deviceId)) {
    throw new Error(`허용되지 않은 기기입니다. ${operator.email}은(는) ${allowedDeviceIds.join(", ")}에서만 사용할 수 있습니다.`);
  }

  if (!manual && operator.role !== AdminRole.ADMIN && operator.role !== AdminRole.TEACHER) {
    throw new Error("스캔 권한이 없는 운영자입니다.");
  }

  const student = await prisma.student.findFirst({
    where: {
      OR: [{ qrToken: normalizedToken }, { studentNo: normalizedToken }],
      isActive: true,
    },
  });

  const requestReceivedAt = new Date();
  const scannedAt = resolveScannedAt(capturedAt, requestReceivedAt);
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

function resolveScannedAt(capturedAt: Date | undefined, fallback: Date) {
  if (!capturedAt || Number.isNaN(capturedAt.getTime())) {
    return fallback;
  }

  const diffMs = Math.abs(fallback.getTime() - capturedAt.getTime());
  const maxAcceptedDriftMs = 1000 * 60 * 120;

  if (diffMs > maxAcceptedDriftMs) {
    return fallback;
  }

  return capturedAt;
}

function buildDashboardStudentWhere(filters: DashboardFilters): Prisma.StudentWhereInput {
  const normalizedQ = filters.q?.trim() ?? "";
  const grade = filters.grade?.trim() ? Number(filters.grade) : undefined;
  const classNo = filters.classNo?.trim() ? Number(filters.classNo) : undefined;

  return {
    isActive: true,
    ...(normalizedQ
      ? {
          OR: [
            { name: { contains: normalizedQ } },
            { studentNo: { contains: normalizedQ } },
          ],
        }
      : {}),
    ...(grade ? { grade } : {}),
    ...(classNo ? { classNo } : {}),
  };
}

function hasDashboardStudentFilter(filters: DashboardFilters) {
  return Boolean(filters.q?.trim() || filters.grade?.trim() || filters.classNo?.trim());
}

function buildDashboardStatusWhere(eventId: string, filters: DashboardFilters): Prisma.AttendanceStatusWhereInput {
  const status = filters.status?.trim().toUpperCase();

  return {
    eventId,
    ...(status ? { finalStatus: status as FinalStatus } : {}),
    student: buildDashboardStudentWhere(filters),
  };
}

export async function getDashboardSnapshot(filters: DashboardFilters = {}, statusLimit?: number) {
  const event = await getTodayEvent();

  if (!event) {
    return null;
  }

  const studentWhere = buildDashboardStudentWhere(filters);
  const shouldFilterLogsByStudent = hasDashboardStudentFilter(filters);
  const statusWhere = buildDashboardStatusWhere(event.id, filters);

  const [
    targetCount,
    checkinCount,
    checkoutCount,
    completedCount,
    missingCheckoutCount,
    filteredStatusCount,
    statuses,
    recentLogs,
  ] = await Promise.all([
    prisma.student.count({ where: { isActive: true } }),
    prisma.attendanceStatus.count({ where: { eventId: event.id, firstCheckinAt: { not: null } } }),
    prisma.attendanceStatus.count({ where: { eventId: event.id, firstCheckoutAt: { not: null } } }),
    prisma.attendanceStatus.count({
      where: {
        eventId: event.id,
        finalStatus: { in: [FinalStatus.COMPLETED, FinalStatus.MANUAL_COMPLETED] },
      },
    }),
    prisma.attendanceStatus.count({ where: { eventId: event.id, finalStatus: FinalStatus.MISSING_CHECKOUT } }),
    prisma.attendanceStatus.count({ where: statusWhere }),
    prisma.attendanceStatus.findMany({
      where: statusWhere,
      include: { student: true },
      orderBy: [{ student: { grade: "asc" } }, { student: { classNo: "asc" } }, { student: { name: "asc" } }],
      ...(statusLimit ? { take: statusLimit } : {}),
    }),
    prisma.attendanceLog.findMany({
      where: {
        eventId: event.id,
        ...(shouldFilterLogsByStudent ? { student: studentWhere } : {}),
      },
      include: { student: true, operator: true },
      orderBy: { scannedAt: "desc" },
      take: 30,
    }),
  ]);

  const metrics = {
    targetCount,
    checkinCount,
    checkoutCount,
    completedCount,
    missingCheckinCount: Math.max(targetCount - checkinCount, 0),
    missingCheckoutCount,
  };

  return { event, statuses, statusCount: filteredStatusCount, recentLogs, metrics };
}

export async function getRecentScanLogs(action: ScanAction, limit = 8) {
  const event = await getTodayEvent();

  if (!event) {
    return [];
  }

  const actionType = action === "checkin" ? ActionType.CHECKIN : ActionType.CHECKOUT;

  return prisma.attendanceLog.findMany({
    where: {
      eventId: event.id,
      actionType,
    },
    include: {
      student: true,
      operator: true,
    },
    orderBy: { scannedAt: "desc" },
    take: limit,
  });
}

export async function getManualAdjustments(limit = 12) {
  const event = await getTodayEvent();

  if (!event) {
    return [];
  }

  return prisma.manualAdjustment.findMany({
    where: { eventId: event.id },
    include: {
      student: true,
      operator: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getOperationSnapshot(filters: OperationFilters) {
  const event = await getTodayEvent();

  if (!event) {
    return null;
  }

  const normalizedQ = filters.q?.trim() ?? "";
  const classNo = filters.classNo?.trim() ? Number(filters.classNo) : undefined;
  const validity = filters.validity?.trim() ?? "";
  const actionType = filters.actionType?.trim().toUpperCase() ?? "";

  const studentWhere =
    normalizedQ || classNo
      ? {
          ...(normalizedQ
            ? {
                OR: [
                  { name: { contains: normalizedQ } },
                  { studentNo: { contains: normalizedQ } },
                ],
              }
            : {}),
          ...(classNo ? { classNo } : {}),
        }
      : undefined;

  const attendanceLogs = await prisma.attendanceLog.findMany({
    where: {
      eventId: event.id,
      ...(actionType
        ? {
            actionType: actionType as ActionType,
          }
        : {}),
      ...(validity === "VALID" ? { isValid: true } : {}),
      ...(validity === "INVALID" ? { isValid: false } : {}),
      ...(studentWhere ? { student: studentWhere } : {}),
    },
    include: {
      student: true,
      operator: true,
    },
    orderBy: { scannedAt: "desc" },
    take: 150,
  });

  const manualAdjustments = await prisma.manualAdjustment.findMany({
    where: {
      eventId: event.id,
      ...(actionType
        ? {
            actionType: actionType as ActionType,
          }
        : {}),
      ...(studentWhere ? { student: studentWhere } : {}),
    },
    include: {
      student: true,
      operator: true,
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const qrIssues = await prisma.qrIssueLog.findMany({
    where: {
      ...(studentWhere ? { student: studentWhere } : {}),
    },
    include: {
      student: true,
      operator: true,
    },
    orderBy: { issuedAt: "desc" },
    take: 80,
  });

  return {
    event,
    attendanceLogs,
    manualAdjustments,
    qrIssues,
  };
}
