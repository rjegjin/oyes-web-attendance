import { NextRequest, NextResponse } from "next/server";
import { getDashboardSnapshot, FinalStatus } from "@/lib/attendance";
import { buildCsv } from "@/lib/csv";
import { matchesStudentFilter, type DashboardFilters } from "@/lib/attendance-report";

export async function GET(request: NextRequest) {
  const snapshot = await getDashboardSnapshot();

  if (!snapshot) {
    return NextResponse.json({ ok: false, message: "활성화된 행사가 없습니다." }, { status: 404 });
  }

  const url = new URL(request.url);
  const filters: DashboardFilters = {
    q: url.searchParams.get("q") ?? "",
    classNo: url.searchParams.get("classNo") ?? "",
    status: url.searchParams.get("status") ?? "",
  };

  const rows = snapshot.statuses
    .filter((status: (typeof snapshot.statuses)[number]) => matchesStudentFilter(status.student, status.finalStatus, filters))
    .map((status: (typeof snapshot.statuses)[number]) => [
      snapshot.event.title,
      status.student.studentNo,
      status.student.name,
      status.student.grade,
      status.student.classNo,
      status.firstCheckinAt ? status.firstCheckinAt.toISOString() : "",
      status.firstCheckoutAt ? status.firstCheckoutAt.toISOString() : "",
      status.finalStatus,
      status.finalStatus === FinalStatus.COMPLETED || status.finalStatus === FinalStatus.MANUAL_COMPLETED
        ? "Y"
        : "N",
    ]);

  const csv = buildCsv([
    ["행사", "학번", "이름", "학년", "반", "체크인", "체크아웃", "상태", "완료여부"],
    ...rows,
  ]);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
