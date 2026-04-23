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

const STATUS_DISPLAY_LIMIT = 30;

function buildQuery(filters: DashboardFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.grade) params.set("grade", filters.grade);
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
  const displayedStatuses = filteredStatuses.slice(0, STATUS_DISPLAY_LIMIT);
  const statusByStudentId = new Map(statuses.map((status: (typeof statuses)[number]) => [status.studentId, status]));
  const filteredLogs = recentLogs.filter((log: (typeof recentLogs)[number]) => {
    if (!log.student) {
      return !filters.q && !filters.grade && !filters.classNo && !filters.status;
    }

    const status = statusByStudentId.get(log.student.id)?.finalStatus ?? FinalStatus.PENDING;
    return matchesStudentFilter(log.student, status, filters);
  });
  const exportHref = `/api/export/attendance${buildQuery(filters)}`;
  const completionRate = metrics.targetCount > 0 ? Math.round((metrics.completedCount / metrics.targetCount) * 100) : 0;
  const attentionCount = metrics.missingCheckinCount + metrics.missingCheckoutCount;

  return (
    <main className="shell">
      <AutoRefresh interval={5000} />
      <section className="hero command-hero">
        <div className="hero-copy">
          <p className="eyebrow">Event Control Room</p>
          <h1>오예스 출결 웹 시스템</h1>
          <p className="muted">
            행사 당일 체크인, 체크아웃, 예외 처리, QR 재발급, 로그 추적까지 한 화면 흐름으로 운영할 수
            있도록 정리한 출결 대시보드입니다.
          </p>
          <div className="hero-status-strip">
            <span>{formatDate(event.eventDate)}</span>
            <span>체크인 {formatTime(event.checkinStartAt)} - {formatTime(event.checkinEndAt)}</span>
            <span>체크아웃 {formatTime(event.checkoutStartAt)} - {formatTime(event.checkoutEndAt)}</span>
          </div>
        </div>
        <div className="command-panel">
          <div className="command-panel-header">
            <div>
              <p className="eyebrow">Live Completion</p>
              <strong>{completionRate}%</strong>
            </div>
            <span className="live-dot">5초 갱신</span>
          </div>
          <div className="command-stats">
            <span>
              <strong>{metrics.targetCount}</strong>
              대상
            </span>
            <span>
              <strong>{metrics.completedCount}</strong>
              완료
            </span>
            <span>
              <strong>{attentionCount}</strong>
              확인 필요
            </span>
          </div>
          <div className="hero-actions command-actions">
            <Link className="primary-button" href="/teacher/check-in">
              체크인 스캔
            </Link>
            <Link className="primary-button" href="/teacher/check-out">
              체크아웃 스캔
            </Link>
            <Link className="secondary-button" href="/admin/manual">
              예외 처리
            </Link>
            <Link className="secondary-button" href={exportHref}>
              CSV 다운로드
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <form className="filter-bar" method="get">
          <label className="input-block">
            <span>검색</span>
            <input name="q" defaultValue={filters.q ?? ""} placeholder="이름 또는 학번" />
          </label>
          <label className="input-block">
            <span>학년</span>
            <input name="grade" defaultValue={filters.grade ?? ""} placeholder="예: 2" />
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
            <p className="eyebrow">Mission Metrics</p>
            <h2>{event.title}</h2>
          </div>
          <div className="badge-row">
            <span className="badge">{formatDate(event.eventDate)}</span>
            <span className="badge">체크인 {formatTime(event.checkinStartAt)} - {formatTime(event.checkinEndAt)}</span>
            <span className="badge">체크아웃 {formatTime(event.checkoutStartAt)} - {formatTime(event.checkoutEndAt)}</span>
          </div>
        </div>

        <div className="metric-grid">
          <DashboardCard label="출석 대상" value={metrics.targetCount} />
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
              <p className="muted">
                필터 결과 {filteredStatuses.length}명 중 {displayedStatuses.length}명 표시
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>학생</th>
                  <th>학번</th>
                  <th>학년/반</th>
                  <th>체크인</th>
                  <th>체크아웃</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {displayedStatuses.map((status: (typeof displayedStatuses)[number]) => (
                  <tr key={status.id}>
                    <td>{status.student.name}</td>
                    <td>{status.student.studentNo}</td>
                    <td>
                      {status.student.grade}학년 {status.student.classNo}반
                    </td>
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
          {filteredStatuses.length > STATUS_DISPLAY_LIMIT ? (
            <p className="muted table-note">
              전체 명단을 모두 펼치지 않습니다. 학년/반/상태 필터로 좁히거나 CSV 다운로드로 전체 결과를 확인하세요.
            </p>
          ) : null}
          {displayedStatuses.length === 0 ? <p className="muted table-note">필터에 맞는 학생이 없습니다.</p> : null}
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
