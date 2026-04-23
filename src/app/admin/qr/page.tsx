import Link from "next/link";
import QRCode from "react-qr-code";
import { prisma } from "@/lib/prisma";
import { formatDate, formatTime } from "@/lib/time";
import { PrintButton } from "./print-button";

type QrPageParams = {
  q?: string;
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
  const classNo = params.classNo?.trim() ?? "";

  const students = await prisma.student.findMany({
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
      ...(classNo ? { classNo: Number(classNo) || undefined } : {}),
    },
    orderBy: [{ grade: "asc" }, { classNo: "asc" }, { name: "asc" }],
  });

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

        {params.message ? (
          <div className={`result-card ${params.status === "ok" ? "result-success" : "result-error"}`}>
            <p className="result-label">{params.status === "ok" ? "처리 성공" : "처리 실패"}</p>
            <h2>{decodeURIComponent(params.message)}</h2>
          </div>
        ) : null}

        <form className="filter-bar" method="get">
          <label className="input-block">
            <span>검색</span>
            <input name="q" defaultValue={q} placeholder="이름 또는 학번" />
          </label>
          <label className="input-block">
            <span>반</span>
            <input name="classNo" defaultValue={classNo} placeholder="예: 3" />
          </label>
          <div className="panel-muted qr-policy-card">
            <p>재발급 정책: 분실/훼손 시 `QR 재발급` 사용</p>
            <p>토큰 정책: `QR_TOKEN_SECRET + 학번 + qrVersion` 해시</p>
            <p>감사 이력: 발급 시각, 버전, 처리자 저장</p>
          </div>
          <div className="button-row filter-actions">
            <button className="primary-button" type="submit">
              인쇄 대상 필터
            </button>
            <Link className="secondary-button" href="/admin/qr">
              전체 보기
            </Link>
          </div>
        </form>
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
                value={`/admin/qr${q || classNo ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(classNo ? { classNo } : {}) }).toString()}` : ""}`}
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
