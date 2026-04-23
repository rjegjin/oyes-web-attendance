import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentQrToken } from "@/lib/student-token";
import { getTodayEvent } from "@/lib/attendance";
import { parseStudentRosterCsv } from "@/lib/student-roster";

async function readCsvText(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const csvText = formData.get("csvText");

  if (typeof csvText === "string" && csvText.trim().length > 0) {
    return csvText;
  }

  if (file instanceof File && file.size > 0) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      throw new Error("CSV 파일만 업로드할 수 있습니다.");
    }

    return file.text();
  }

  throw new Error("업로드할 CSV 파일 또는 텍스트가 필요합니다.");
}

export async function POST(request: NextRequest) {
  try {
    const csvText = await readCsvText(request);
    const parsed = parseStudentRosterCsv(csvText);
    const event = await getTodayEvent();
    const operator = await prisma.adminUser.findUnique({
      where: { email: "admin@school.local" },
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

    await prisma.$transaction(async (tx) => {
      const qrIssueLogs: Array<{
        studentId: string;
        qrToken: string;
        qrVersion: number;
        reason: string;
        operatorId?: string;
      }> = [];

      for (const row of parsed.rows) {
        const existing = existingByStudentNo.get(row.studentNo);

        const student = await tx.student.upsert({
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
          qrIssueLogs.push({
            studentId: student.id,
            qrToken: student.qrToken,
            qrVersion: student.qrVersion,
            reason: "명단 업로드 초기 발급",
            ...(operator?.id ? { operatorId: operator.id } : {}),
          });
        } else if (!existing.isActive) {
          reactivatedCount += 1;
          qrIssueLogs.push({
            studentId: student.id,
            qrToken: student.qrToken,
            qrVersion: student.qrVersion,
            reason: "재활성화 후 QR 재발급",
            ...(operator?.id ? { operatorId: operator.id } : {}),
          });
        } else {
          updatedCount += 1;
        }
      }

      if (qrIssueLogs.length > 0) {
        await tx.qrIssueLog.createMany({
          data: qrIssueLogs,
        });
      }

      if (event) {
        const students = await tx.student.findMany({
          where: { isActive: true },
          select: { id: true },
        });
        const existingStatuses = await tx.attendanceStatus.findMany({
          where: { eventId: event.id },
          select: { studentId: true },
        });
        const existingIds = new Set(existingStatuses.map((status: (typeof existingStatuses)[number]) => status.studentId));
        const missingStudents = students.filter((student: (typeof students)[number]) => !existingIds.has(student.id));

        if (missingStudents.length > 0) {
          await tx.attendanceStatus.createMany({
            data: missingStudents.map((student: (typeof missingStudents)[number]) => ({
              eventId: event.id,
              studentId: student.id,
            })),
          });
        }
      }
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    const url = new URL("/admin/students", request.url);
    url.searchParams.set("status", "ok");
    url.searchParams.set("message", `명단 ${parsed.summary.acceptedRows}명 반영 완료`);
    url.searchParams.set("totalRows", String(parsed.summary.totalDataRows));
    url.searchParams.set("acceptedRows", String(parsed.summary.acceptedRows));
    url.searchParams.set("skippedRows", String(parsed.summary.skippedRows));
    url.searchParams.set("warningCount", String(parsed.summary.warningCount));
    url.searchParams.set("createdCount", String(createdCount));
    url.searchParams.set("updatedCount", String(updatedCount));
    url.searchParams.set("reactivatedCount", String(reactivatedCount));
    if (parsed.warnings.length > 0) {
      url.searchParams.set(
        "warnings",
        parsed.warnings
          .slice(0, 5)
          .map((warning: (typeof parsed.warnings)[number]) => warning.message)
          .join(" | "),
      );
    }

    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      return NextResponse.redirect(url, 303);
    }

    return NextResponse.json({
      ok: true,
      imported: parsed.summary.acceptedRows,
      createdCount,
      updatedCount,
      reactivatedCount,
      warnings: parsed.warnings,
    });
  } catch (error) {
    const url = new URL("/admin/students", request.url);
    url.searchParams.set("status", "error");
    url.searchParams.set("message", error instanceof Error ? error.message : "업로드 실패");

    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      return NextResponse.redirect(url, 303);
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "업로드 실패",
      },
      { status: 400 },
    );
  }
}
