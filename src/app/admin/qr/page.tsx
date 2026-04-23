import Link from "next/link";
import QRCode from "react-qr-code";
import { prisma } from "@/lib/prisma";
import { formatDate, formatTime } from "@/lib/time";
import { QrFilterForm } from "./filter-form";
import { PrintButton } from "./print-button";

type QrPageParams = {
  q?: string;
  grade?: string;
  classNo?: string;
  status?: string;
  message?: string;
};

export default async function QRPrintPage({
  searchParams,
}: {
  searchParams?: Promise<QrPageParams | undefined>;
}) {
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const grade = params.grade?.trim() ?? "";
  const classNo = params.classNo?.trim() ?? "";
  const selectedGrade = grade ? Number(grade) || undefined : undefined;
  const selectedClassNo = classNo ? Number(classNo) || undefined : undefined;

  const classRoster = await prisma.student.findMany({
    where: { isActive: true },
    select: {
      grade: true,
      classNo: true,
    },
    distinct: ["grade", "classNo"],
    orderBy: [{ grade: "asc" }, { classNo: "asc" }],
  });

  const classOptionsByGrade = classRoster.reduce<Record<string, typeof classRoster>>((groups, item) => {
    const key = String(item.grade);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
  const shouldLoadStudents = Boolean(q || (selectedGrade && selectedClassNo));

  const students = shouldLoadStudents
    ? await prisma.student.findMany({
        where: {
          isActive: true,
          ...(q
            ? {
                OR: [
                  { name: { contains: q } },
                  { studentNo: { contains: q } },
                ],
              }
            : {}),
          ...(selectedGrade ? { grade: selectedGrade } : {}),
          ...(selectedClassNo ? { classNo: selectedClassNo } : {}),
        },
        orderBy: [{ grade: "asc" }, { classNo: "asc" }, { name: "asc" }],
      })
    : [];

  const recentIssues = await prisma.qrIssueLog.findMany({
    include: {
      student: true,
      operator: true,
    },
    orderBy: { issuedAt: "desc" },
    take: 8,
  });

  return (
    <main className="shell qr-print-page">
      <div className="subnav print-hidden">
        <Link href="/">대시보드</Link>
        <Link href="/admin/manual">수동 처리</Link>
        <Link href="/admin/students">명단 업로드</Link>
      </div>

      <section className="panel print-hidden">
        <div className="section-header">
          <div>
            <p className="eyebrow">QR 코드 출력</p>
            <h1>학생용 QR 코드 인쇄 및 재발급</h1>
          </div>
          <PrintButton />
        </div>
        <p className="muted">
          현재 필터에 잡힌 학생만 인쇄합니다. QR 재발급을 누르면 기존 종이는 즉시 무효가 되고, 새 QR만
          유효합니다.
        </p>
        <p className="muted">
          기본 상태에서는 전체 1300여 명을 불러오지 않습니다. 학년과 반을 선택하거나, 이름/학번으로
          검색해서 필요한 학생만 여세요.
        </p>

        {params.message ? (
          <div className={`result-card ${params.status === "ok" ? "result-success" : "result-error"}`}>
            <p className="result-label">{params.status === "ok" ? "처리 성공" : "처리 실패"}</p>
            <h2>{decodeURIComponent(params.message)}</h2>
          </div>
        ) : null}

        <QrFilterForm q={q} grade={grade} classNo={classNo} classOptionsByGrade={classOptionsByGrade} />
      </section>

      <section className="panel print-hidden">
        <div className="section-header">
          <div>
            <p className="eyebrow">인쇄 대상</p>
            <h2>{students.length}명 선택됨</h2>
          </div>
        </div>
        {!shouldLoadStudents ? (
          <p className="muted">학년과 반을 선택하거나, 이름/학번 검색으로 필요한 학생만 불러오세요.</p>
        ) : null}
        {selectedGrade && !selectedClassNo && !q ? (
          <p className="muted">{selectedGrade}학년을 선택했습니다. 반까지 선택하면 약 30명 단위로 QR을 인쇄할 수 있습니다.</p>
        ) : null}
      </section>

      <section className="panel print-hidden">
        <div className="section-header">
          <div>
            <p className="eyebrow">최근 발급</p>
            <h2>QR 발급 이력</h2>
          </div>
        </div>
        <div className="log-list">
          {recentIssues.map((issue: (typeof recentIssues)[number]) => (
            <article className="log-item" key={issue.id}>
              <div>
                <p className="log-title">
                  {issue.student.name} / v{issue.qrVersion}
                </p>
                <p className="muted">
                  {formatDate(issue.issuedAt)} {formatTime(issue.issuedAt)} · {issue.reason ?? "사유 없음"} ·{" "}
                  {issue.operator?.name ?? "시스템"}
                </p>
              </div>
              <span className="badge">{issue.student.studentNo}</span>
            </article>
          ))}
        </div>
      </section>

      <div className="qr-grid">
        {students.map((student: (typeof students)[number]) => (
          <div key={student.id} className="qr-card">
            <div className="qr-header">
              <span className="qr-grade">
                {student.grade}학년 {student.classNo}반
              </span>
              <h2 className="qr-name">{student.name}</h2>
              <span className="qr-no">{student.studentNo}</span>
            </div>
            <div className="qr-code-wrapper">
              <QRCode value={student.qrToken} size={148} />
            </div>
            <div className="qr-meta">
              <span>버전 v{student.qrVersion}</span>
              <span>
                발급 {formatDate(student.qrIssuedAt)} {formatTime(student.qrIssuedAt)}
              </span>
            </div>
            <form action={`/api/students/${student.id}/reissue`} className="print-hidden qr-action-form" method="post">
              <input name="reason" type="hidden" value="관리자 수동 재발급" />
              <input name="operatorEmail" type="hidden" value="admin@school.local" />
              <input
                name="returnTo"
                type="hidden"
                value={`/admin/qr${q || grade || classNo ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(grade ? { grade } : {}), ...(classNo ? { classNo } : {}) }).toString()}` : ""}`}
              />
              <button className="secondary-button" type="submit">
                QR 재발급
              </button>
            </form>
          </div>
        ))}
      </div>
    </main>
  );
}
