import Link from "next/link";
import { ManualAdjustmentFeed } from "@/components/recent-scan-feed";
import { getManualAdjustments } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";

export default async function ManualPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; message?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const [students, adjustments] = await Promise.all([
    prisma.student.findMany({
      where: { isActive: true },
      orderBy: [{ classNo: "asc" }, { name: "asc" }],
      take: 12,
    }),
    getManualAdjustments(10),
  ]);

  return (
    <main className="shell">
      <div className="subnav">
        <Link href="/">대시보드</Link>
        <Link href="/teacher/check-in">체크인 화면</Link>
        <Link href="/teacher/check-out">체크아웃 화면</Link>
        <Link href="/admin/students">명단 업로드</Link>
        <Link href="/admin/logs">운영 로그</Link>
      </div>

      <section className="panel panel-tight">
        <div className="section-header">
          <div>
            <p className="eyebrow">예외 처리</p>
            <h1>수동 체크인 / 체크아웃</h1>
          </div>
        </div>
        <p className="muted">
          휴대폰 분실, QR 훼손, 배터리 방전 같은 상황을 위해 관리자만 수동 처리를 허용합니다.
        </p>

        {params?.message ? (
          <div className={`result-card ${params.status === "ok" ? "result-success" : "result-error"}`}>
            <p className="result-label">{params.status === "ok" ? "처리 성공" : "처리 실패"}</p>
            <h2>{decodeURIComponent(params.message)}</h2>
          </div>
        ) : null}

        <form action="/api/manual/checkin" className="stack-lg" method="post">
          <div className="form-grid">
            <label className="input-block">
              <span>학번 또는 QR 토큰</span>
              <input name="token" placeholder="예: 2026301" />
            </label>
            <label className="input-block">
              <span>운영자 이메일</span>
              <input defaultValue="admin@school.local" name="operatorEmail" />
            </label>
            <label className="input-block">
              <span>기기 ID</span>
              <input defaultValue="manual-desk-01" name="deviceId" />
            </label>
            <label className="input-block">
              <span>사유</span>
              <input name="reason" placeholder="예: 배터리 방전" />
            </label>
          </div>
          <div className="button-row">
            <button className="primary-button" formAction="/api/manual/checkin">
              수동 체크인
            </button>
            <button className="secondary-button" formAction="/api/manual/checkout">
              수동 체크아웃
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">샘플 학생</p>
            <h2>로컬 테스트용 토큰</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>학번</th>
                <th>반</th>
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
                  <td className="mono-cell">{student.qrToken}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">체크인 가능 시간 밖이면 수동 처리만 허용됩니다. 현재 브라우저 시각 기준으로 동작합니다.</p>
      </section>

      <ManualAdjustmentFeed adjustments={adjustments} />
    </main>
  );
}
