import { NextRequest, NextResponse } from "next/server";
import { buildCsv } from "@/lib/csv";
import { getOperationSnapshot, type OperationFilters } from "@/lib/attendance";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const filters: OperationFilters = {
    q: url.searchParams.get("q") ?? "",
    classNo: url.searchParams.get("classNo") ?? "",
    validity: url.searchParams.get("validity") ?? "",
    actionType: url.searchParams.get("actionType") ?? "",
  };

  const snapshot = await getOperationSnapshot(filters);

  if (!snapshot) {
    return NextResponse.json({ ok: false, message: "활성화된 행사가 없습니다." }, { status: 404 });
  }

  const rows: Array<Array<string | number>> = [
    ["category", "timestamp", "studentNo", "name", "detail1", "detail2", "detail3"],
  ];

  for (const log of snapshot.attendanceLogs) {
    rows.push([
      "attendance_log",
      log.scannedAt.toISOString(),
      log.student?.studentNo ?? "",
      log.student?.name ?? "미등록 토큰",
      log.actionType,
      log.isValid ? "VALID" : `INVALID:${log.invalidReason ?? "unknown"}`,
      log.deviceId,
    ]);
  }

  for (const item of snapshot.manualAdjustments) {
    rows.push([
      "manual_adjustment",
      item.createdAt.toISOString(),
      item.student.studentNo,
      item.student.name,
      item.actionType,
      item.reason,
      item.operator.name,
    ]);
  }

  for (const issue of snapshot.qrIssues) {
    rows.push([
      "qr_issue",
      issue.issuedAt.toISOString(),
      issue.student.studentNo,
      issue.student.name,
      `v${issue.qrVersion}`,
      issue.reason ?? "",
      issue.operator?.name ?? "시스템",
    ]);
  }

  return new NextResponse(buildCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="operations-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
