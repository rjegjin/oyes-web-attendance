import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentQrToken } from "@/lib/student-token";

type RouteContext = {
  params: Promise<{ studentId: string }>;
};

async function readPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { studentId } = await context.params;
  const payload = (await readPayload(request)) as {
    reason?: string;
    operatorEmail?: string;
    returnTo?: string;
  };

  const reason = typeof payload.reason === "string" && payload.reason.trim().length > 0
    ? payload.reason.trim()
    : "관리자 수동 재발급";
  const operatorEmail =
    typeof payload.operatorEmail === "string" && payload.operatorEmail.trim().length > 0
      ? payload.operatorEmail.trim()
      : "admin@school.local";

  try {
    const operator = await prisma.adminUser.findUnique({
      where: { email: operatorEmail },
      select: { id: true },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        throw new Error("학생을 찾을 수 없습니다.");
      }

      const nextVersion = student.qrVersion + 1;
      const nextToken = createStudentQrToken(student.studentNo, nextVersion);
      const nextIssuedAt = new Date();

      const nextStudent = await tx.student.update({
        where: { id: student.id },
        data: {
          qrVersion: nextVersion,
          qrToken: nextToken,
          qrIssuedAt: nextIssuedAt,
        },
      });

      await tx.qrIssueLog.create({
        data: {
          studentId: student.id,
          qrToken: nextToken,
          qrVersion: nextVersion,
          reason,
          operatorId: operator?.id,
          issuedAt: nextIssuedAt,
        },
      });

      return nextStudent;
    });

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const url = new URL(
        typeof payload.returnTo === "string" && payload.returnTo.startsWith("/")
          ? payload.returnTo
          : "/admin/qr",
        request.url,
      );
      url.searchParams.set("status", "ok");
      url.searchParams.set("message", `${updated.name} QR v${updated.qrVersion} 재발급 완료`);
      return NextResponse.redirect(url, 303);
    }

    return NextResponse.json({
      ok: true,
      studentId: updated.id,
      qrVersion: updated.qrVersion,
      qrIssuedAt: updated.qrIssuedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QR 재발급 실패";
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const url = new URL(
        typeof payload.returnTo === "string" && payload.returnTo.startsWith("/")
          ? payload.returnTo
          : "/admin/qr",
        request.url,
      );
      url.searchParams.set("status", "error");
      url.searchParams.set("message", message);
      return NextResponse.redirect(url, 303);
    }

    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
