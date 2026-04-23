import Link from "next/link";
import { DashboardCard } from "@/components/dashboard-card";
import { prisma } from "@/lib/prisma";
import { formatDate, formatTime } from "@/lib/time";

type StudentPageParams = {
  status?: string;
  message?: string;
  totalRows?: string;
  acceptedRows?: string;
  skippedRows?: string;
  warningCount?: string;
  createdCount?: string;
  updatedCount?: string;
  reactivatedCount?: string;
  warnings?: string;
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams?: Promise<StudentPageParams | undefined>;
}) {
  const params = (await searchParams) ?? {};
  const students = await prisma.student.findMany({
    orderBy: [{ grade: "asc" }, { classNo: "asc" }, { name: "asc" }],
  });
  const warningMessages = params.warnings ? decodeURIComponent(params.warnings).split(" | ") : [];

  return (
    <main className="shell">
      <div className="subnav">
        <Link href="/">대시보드</Link>
        <Link href="/admin/manual">수동 처리</Link>
        <Link href="/admin/qr">QR 인쇄</Link>
      </div>

      <section className="panel panel-tight">
        <div className="section-header">
          <div>
            <p className="eyebrow">명단 업로드</p>
            <h1>학생 기본 명단 받기</h1>
          </div>
        </div>
        <p className="muted">
          학교에서 받은 학급 명단 CSV 또는 엑셀에서 저장한 CSV를 업로드합니다. 헤더는 `학번`, `이름`,
          `학년`, `반`이 필수이고 `사진URL`은 선택입니다.
        </p>
        <p className="muted">
          권장 입력원은 교무실 학생 명단 또는 NEIS/행정시스템에서 내린 표입니다. 엑셀 원본은 먼저 CSV로
          저장한 뒤 업로드합니다.
        </p>

        {params.message ? (
          <div className={`result-card ${params.status === "ok" ? "result-success" : "result-error"}`}>
            <p className="result-label">{params.status === "ok" ? "처리 성공" : "처리 실패"}</p>
            <h2>{decodeURIComponent(params.message)}</h2>
            {params.status === "ok" ? (
              <div className="mini-metric-grid">
                <DashboardCard label="원본 행" value={params.totalRows ?? "0"} />
                <DashboardCard label="반영" value={params.acceptedRows ?? "0"} tone="accent" />
                <DashboardCard label="생성" value={params.createdCount ?? "0"} tone="accent" />
                <DashboardCard label="갱신" value={params.updatedCount ?? "0"} />
                <DashboardCard label="재활성화" value={params.reactivatedCount ?? "0"} />
                <DashboardCard label="건너뜀" value={params.skippedRows ?? "0"} tone="warn" />
              </div>
            ) : null}
            {warningMessages.length > 0 ? (
              <div className="warning-list">
                {warningMessages.map((warning: (typeof warningMessages)[number]) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="button-row" style={{ marginTop: 16 }}>
          <a className="secondary-button" href="/api/students/template">
            CSV 템플릿 다운로드
          </a>
        </div>

        <form action="/api/students/import" className="stack-lg" encType="multipart/form-data" method="post">
          <label className="input-block">
            <span>CSV 파일</span>
            <input accept=".csv,text/csv" name="file" type="file" />
          </label>
          <label className="input-block">
            <span>또는 CSV 텍스트 붙여넣기</span>
            <textarea
              name="csvText"
              rows={8}
              placeholder="학번,이름,학년,반&#10;2026301,홍길동,2,3"
            />
          </label>
          <div className="panel-muted">
            <p>필수 헤더: `학번`, `이름`, `학년`, `반`</p>
            <p>선택 헤더: `사진URL`</p>
            <p>중복 학번, 빈 값, 잘못된 학년/반은 자동으로 건너뜁니다.</p>
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              명단 업로드
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">현재 명단</p>
            <h2>등록된 학생 목록</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>학번</th>
                <th>반</th>
                <th>QR 버전</th>
                <th>최근 발급</th>
                <th>QR 토큰</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student: (typeof students)[number]) => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td>{student.studentNo}</td>
                  <td>
                    {student.grade}학년 {student.classNo}반
                  </td>
                  <td>v{student.qrVersion}</td>
                  <td>
                    {formatDate(student.qrIssuedAt)} {formatTime(student.qrIssuedAt)}
                  </td>
                  <td className="mono-cell">{student.qrToken}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
