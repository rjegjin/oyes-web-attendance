import Link from "next/link";
import { DashboardCard } from "@/components/dashboard-card";
import { AutoRefresh } from "@/components/auto-refresh";
import { getDashboardSnapshot, FinalStatus } from "@/lib/attendance";
import { matchesStudentFilter, type DashboardFilters } from "@/lib/attendance-report";
import { formatDate, formatTime } from "@/lib/time";

const statusLabel: Record<FinalStatus, string> = {
  PENDING: "대기",
  COMPLETED: "완료",
  MISSING_CHECKIN: "체크인 누락",
  MISSING_CHECKOUT: "체크아웃 누락",
  CHECKOUT_ONLY: "체크아웃만 존재",
  ABSENT: "미참여",
  MANUAL_COMPLETED: "수동 완료",
};

function buildQuery(filters: DashboardFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.classNo) params.set("classNo", filters.classNo);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<DashboardFilters | undefined>;
}) {
  const filters: DashboardFilters = (await searchParams) ?? {};
  const snapshot = await getDashboardSnapshot();

  if (!snapshot) {
    return (
      <main className="shell">
        <section className="hero">
          <div>
            <p className="eyebrow">OYES Attendance</p>
            <h1>오늘 활성화된 행사가 없습니다.</h1>
            <p className="muted">시드 데이터를 넣었다면 `npm run db:seed` 실행 뒤 다시 확인하세요.</p>
          </div>
        </section>
      </main>
    );
  }

  const { event, statuses, recentLogs, metrics } = snapshot;
  const filteredStatuses = statuses.filter((status) =>
    matchesStudentFilter(status.student, status.finalStatus, filters),
  );
  const statusByStudentId = new Map(statuses.map((status: (typeof statuses)[number]) => [status.studentId, status]));
  const filteredLogs = recentLogs.filter((log: (typeof recentLogs)[number]) => {
    if (!log.student) {
      return !filters.q && !filters.classNo && !filters.status;
    }

    const status = statusByStudentId.get(log.student.id)?.finalStatus ?? FinalStatus.PENDING;
    return matchesStudentFilter(log.student, status, filters);
  });
  const exportHref = `/api/export/attendance${buildQuery(filters)}`;

  return (
    <main className="shell">
      <AutoRefresh interval={5000} />
      <section className="hero">
        <div>
          <p className="eyebrow">Local Deployment Architecture</p>
          <h1>오예스 출결 웹 시스템</h1>
          <p className="muted">
            로컬에서는 Next.js 앱 한 대로 구동하고, 배포 시에는 앱 서버와 PostgreSQL을 각각 Vercel,
            Supabase로 분리하는 구조를 전제로 구성했습니다.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="primary-button" href="/teacher/check-in">
            체크인 스캔 화면
          </Link>
          <Link className="secondary-button" href="/teacher/check-out">
            체크아웃 스캔 화면
          </Link>
          <Link className="secondary-button" href="/admin/manual">
            예외 처리
          </Link>
          <Link className="secondary-button" href="/admin/students">
            명단 업로드
          </Link>
          <Link className="secondary-button" href={exportHref}>
            CSV 다운로드
          </Link>
        </div>
      </section>

      <section className="panel">
        <form className="filter-bar" method="get">
          <label className="input-block">
            <span>검색</span>
            <input name="q" defaultValue={filters.q ?? ""} placeholder="이름 또는 학번" />
          </label>
          <label className="input-block">
            <span>반</span>
            <input name="classNo" defaultValue={filters.classNo ?? ""} placeholder="예: 3" />
          </label>
          <label className="input-block">
            <span>상태</span>
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">전체</option>
              <option value="COMPLETED">완료</option>
              <option value="MISSING_CHECKOUT">체크아웃 누락</option>
              <option value="MISSING_CHECKIN">체크인 누락</option>
              <option value="CHECKOUT_ONLY">체크아웃만 존재</option>
              <option value="ABSENT">미참여</option>
              <option value="MANUAL_COMPLETED">수동 완료</option>
            </select>
          </label>
          <div className="button-row filter-actions">
            <button className="primary-button" type="submit">
              필터 적용
            </button>
            <Link className="secondary-button" href="/">
              초기화
            </Link>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">오늘 행사</p>
            <h2>{event.title}</h2>
          </div>
          <div className="badge-row">
            <span className="badge">{formatDate(event.eventDate)}</span>
            <span className="badge">체크인 {formatTime(event.checkinStartAt)} - {formatTime(event.checkinEndAt)}</span>
            <span className="badge">체크아웃 {formatTime(event.checkoutStartAt)} - {formatTime(event.checkoutEndAt)}</span>
          </div>
        </div>

        <div className="metric-grid">
          <DashboardCard label="대상 학생" value={metrics.targetCount} />
          <DashboardCard label="체크인 완료" value={metrics.checkinCount} tone="accent" />
          <DashboardCard label="체크아웃 완료" value={metrics.checkoutCount} tone="accent" />
          <DashboardCard label="최종 완료" value={metrics.completedCount} tone="accent" />
          <DashboardCard label="체크인 누락 계열" value={metrics.missingCheckinCount} tone="warn" />
          <DashboardCard label="체크아웃 누락" value={metrics.missingCheckoutCount} tone="warn" />
        </div>
      </section>

      <section className="two-column">
        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">실시간 상태</p>
              <h2>학생별 진행 현황</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>학생</th>
                  <th>학번</th>
                  <th>체크인</th>
                  <th>체크아웃</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredStatuses.map((status: (typeof filteredStatuses)[number]) => (
                  <tr key={status.id}>
                    <td>{status.student.name}</td>
                    <td>{status.student.studentNo}</td>
                    <td>{formatTime(status.firstCheckinAt)}</td>
                    <td>{formatTime(status.firstCheckoutAt)}</td>
                    <td>
                      <span className={`status-pill status-${status.finalStatus.toLowerCase()}`}>
                        {statusLabel[status.finalStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">최근 스캔</p>
              <h2>실시간 로그</h2>
            </div>
          </div>
          <div className="log-list">
            {filteredLogs.map((log: (typeof filteredLogs)[number]) => (
              <article className="log-item" key={log.id}>
                <div>
                  <p className="log-title">
                    {log.student?.name ?? "미등록 토큰"} / {log.actionType}
                  </p>
                  <p className="muted">
                    {formatTime(log.scannedAt)} · {log.deviceId} · {log.operator?.name ?? "운영자 미지정"}
                  </p>
                </div>
                <span className={`status-pill ${log.isValid ? "status-completed" : "status-missing_checkin"}`}>
                  {log.isValid ? "유효" : log.invalidReason ?? "무효"}
                </span>
              </article>
            ))}
            {filteredLogs.length === 0 ? <p className="muted">필터에 맞는 로그가 없습니다.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
