import Link from "next/link";
import { getOperationSnapshot, type OperationFilters } from "@/lib/attendance";
import { formatDate, formatTime } from "@/lib/time";

function buildExportHref(filters: OperationFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.classNo) params.set("classNo", filters.classNo);
  if (filters.validity) params.set("validity", filters.validity);
  if (filters.actionType) params.set("actionType", filters.actionType);
  const query = params.toString();
  return `/api/export/operations${query ? `?${query}` : ""}`;
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams?: Promise<OperationFilters | undefined>;
}) {
  const filters = (await searchParams) ?? {};
  const snapshot = await getOperationSnapshot(filters);

  if (!snapshot) {
    return (
      <main className="shell">
        <section className="panel">
          <h1>오늘 활성화된 행사가 없습니다.</h1>
        </section>
      </main>
    );
  }

  const exportHref = buildExportHref(filters);

  return (
    <main className="shell">
      <div className="subnav">
        <Link href="/">대시보드</Link>
        <Link href="/admin/manual">수동 처리</Link>
        <Link href="/admin/qr">QR 인쇄</Link>
        <Link href="/admin/students">명단 업로드</Link>
      </div>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">운영 로그</p>
            <h1>행사 운영 이력</h1>
          </div>
          <Link className="secondary-button" href={exportHref}>
            운영 로그 CSV
          </Link>
        </div>

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
            <span>로그 유형</span>
            <select name="actionType" defaultValue={filters.actionType ?? ""}>
              <option value="">전체</option>
              <option value="CHECKIN">체크인</option>
              <option value="CHECKOUT">체크아웃</option>
              <option value="MANUAL_CHECKIN">수동 체크인</option>
              <option value="MANUAL_CHECKOUT">수동 체크아웃</option>
            </select>
          </label>
          <label className="input-block">
            <span>유효성</span>
            <select name="validity" defaultValue={filters.validity ?? ""}>
              <option value="">전체</option>
              <option value="VALID">유효</option>
              <option value="INVALID">무효</option>
            </select>
          </label>
          <div className="button-row filter-actions">
            <button className="primary-button" type="submit">
              필터 적용
            </button>
            <Link className="secondary-button" href="/admin/logs">
              초기화
            </Link>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">스캔 로그</p>
            <h2>체크인/체크아웃 기록</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>시각</th>
                <th>학생</th>
                <th>유형</th>
                <th>기기</th>
                <th>처리자</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.attendanceLogs.map((log: (typeof snapshot.attendanceLogs)[number]) => (
                <tr key={log.id}>
                  <td>
                    {formatDate(log.scannedAt)} {formatTime(log.scannedAt)}
                  </td>
                  <td>{log.student ? `${log.student.name} (${log.student.studentNo})` : "미등록 토큰"}</td>
                  <td>{log.actionType}</td>
                  <td>{log.deviceId}</td>
                  <td>{log.operator?.name ?? "-"}</td>
                  <td>{log.isValid ? "유효" : log.invalidReason ?? "무효"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="two-column">
        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">예외 처리</p>
              <h2>수동 처리 이력</h2>
            </div>
          </div>
          <div className="log-list">
            {snapshot.manualAdjustments.map((item: (typeof snapshot.manualAdjustments)[number]) => (
              <article className="log-item" key={item.id}>
                <div>
                  <p className="log-title">
                    {item.student.name} / {item.actionType}
                  </p>
                  <p className="muted">
                    {formatDate(item.createdAt)} {formatTime(item.createdAt)} · {item.reason} ·{" "}
                    {item.operator.name}
                  </p>
                </div>
                <span className="badge">{item.student.studentNo}</span>
              </article>
            ))}
            {snapshot.manualAdjustments.length === 0 ? <p className="muted">수동 처리 이력이 없습니다.</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">QR 이력</p>
              <h2>QR 발급/재발급</h2>
            </div>
          </div>
          <div className="log-list">
            {snapshot.qrIssues.map((issue: (typeof snapshot.qrIssues)[number]) => (
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
            {snapshot.qrIssues.length === 0 ? <p className="muted">QR 발급 이력이 없습니다.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
