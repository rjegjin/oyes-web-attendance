import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { parseStudentRosterCsv } from "@/lib/student-roster";
import { createStudentQrToken } from "@/lib/student-token";

type CliOptions = {
  csvPath: string;
  envFile?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const args = [...argv];
  let envFile: string | undefined;
  const positional: string[] = [];

  while (args.length > 0) {
    const arg = args.shift();

    if (!arg) {
      continue;
    }

    if (arg === "--env-file") {
      envFile = args.shift();
      continue;
    }

    positional.push(arg);
  }

  if (!positional[0]) {
    throw new Error("사용법: npm run students:import -- <csv-path> [--env-file <env-path>]");
  }

  return {
    csvPath: positional[0],
    envFile,
  };
}

function parseBooleanEnv(value: string | undefined) {
  return value === "1" || value === "true";
}

function ensureDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL 이 없습니다. --env-file 또는 shell 환경변수를 확인하세요.");
  }

  return databaseUrl;
}

async function main() {
  const { csvPath, envFile } = parseArgs(process.argv.slice(2));

  if (envFile) {
    const envPath = resolve(envFile);
    if (!existsSync(envPath)) {
      throw new Error(`env 파일을 찾을 수 없습니다: ${envPath}`);
    }
    dotenv.config({ path: envPath, override: true });
  }

  const csvFullPath = resolve(csvPath);
  if (!existsSync(csvFullPath)) {
    throw new Error(`CSV 파일을 찾을 수 없습니다: ${csvFullPath}`);
  }

  const adapter = new PrismaPg({
    connectionString: ensureDatabaseUrl(),
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const csvText = readFileSync(csvFullPath, "utf8");
    const parsed = parseStudentRosterCsv(csvText);
    const event = await prisma.event.findFirst({
      where: { isActive: true },
      orderBy: { eventDate: "desc" },
    });
    const operatorEmail = process.env.STUDENT_IMPORT_OPERATOR_EMAIL || "admin@school.local";
    const operator = await prisma.adminUser.findUnique({
      where: { email: operatorEmail },
      select: { id: true },
    });
    const existingStudents = await prisma.student.findMany({
      where: {
        studentNo: {
          in: parsed.rows.map((row) => row.studentNo),
        },
      },
      select: {
        id: true,
        studentNo: true,
        isActive: true,
      },
    });
    const existingByStudentNo = new Map(
      existingStudents.map((student: (typeof existingStudents)[number]) => [student.studentNo, student]),
    );

    let createdCount = 0;
    let updatedCount = 0;
    let reactivatedCount = 0;

    for (const row of parsed.rows) {
      const existing = existingByStudentNo.get(row.studentNo);
      const student = await prisma.student.upsert({
        where: { studentNo: row.studentNo },
        create: {
          studentNo: row.studentNo,
          name: row.name,
          gender: row.gender,
          grade: row.grade,
          classNo: row.classNo,
          photoUrl: row.photoUrl ?? null,
          qrToken: createStudentQrToken(row.studentNo, 1),
          qrVersion: 1,
          qrIssuedAt: new Date(),
          isActive: true,
        },
        update: {
          name: row.name,
          gender: row.gender,
          grade: row.grade,
          classNo: row.classNo,
          photoUrl: row.photoUrl ?? null,
          ...(existing?.isActive
            ? {}
            : {
                qrToken: createStudentQrToken(row.studentNo, 1),
                qrVersion: 1,
                qrIssuedAt: new Date(),
              }),
          isActive: true,
        },
      });

      if (!existing) {
        createdCount += 1;
        await prisma.qrIssueLog.create({
          data: {
            studentId: student.id,
            qrToken: student.qrToken,
            qrVersion: student.qrVersion,
            reason: "명단 업로드 초기 발급",
            ...(operator?.id ? { operatorId: operator.id } : {}),
          },
        });
      } else if (!existing.isActive) {
        reactivatedCount += 1;
        await prisma.qrIssueLog.create({
          data: {
            studentId: student.id,
            qrToken: student.qrToken,
            qrVersion: student.qrVersion,
            reason: "재활성화 후 QR 재발급",
            ...(operator?.id ? { operatorId: operator.id } : {}),
          },
        });
      } else {
        updatedCount += 1;
      }
    }

    if (event && !parseBooleanEnv(process.env.SKIP_EVENT_STATUS_SYNC)) {
      const students = await prisma.student.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      const existingStatuses = await prisma.attendanceStatus.findMany({
        where: { eventId: event.id },
        select: { studentId: true },
      });
      const existingIds = new Set(existingStatuses.map((status) => status.studentId));
      const missingStudents = students.filter((student: (typeof students)[number]) => !existingIds.has(student.id));

      if (missingStudents.length > 0) {
        await prisma.attendanceStatus.createMany({
          data: missingStudents.map((student: (typeof missingStudents)[number]) => ({
            eventId: event.id,
            studentId: student.id,
          })),
        });
      }
    }

    const totalActiveStudents = await prisma.student.count({
      where: { isActive: true },
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          csvPath: csvFullPath,
          imported: parsed.summary.acceptedRows,
          createdCount,
          updatedCount,
          reactivatedCount,
          totalActiveStudents,
          activeEvent: event
            ? {
                id: event.id,
                title: event.title,
              }
            : null,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
