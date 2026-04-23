import { AttendanceLog, ManualAdjustment } from "@prisma/client";
import { formatDate, formatTime } from "@/lib/time";

type ScanLogWithRelations = AttendanceLog & {
  student: {
    name: string;
    studentNo: string;
  } | null;
  operator: {
    name: string;
  } | null;
};

type ManualAdjustmentWithRelations = ManualAdjustment & {
  student: {
    name: string;
    studentNo: string;
  };
  operator: {
    name: string;
  };
};

export function RecentScanFeed({
  title,
  eyebrow,
  logs,
}: {
  title: string;
  eyebrow: string;
  logs: ScanLogWithRelations[];
}) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="log-list">
        {logs.map((log: ScanLogWithRelations) => (
          <article className="log-item" key={log.id}>
            <div>
              <p className="log-title">
                {log.student ? `${log.student.name} (${log.student.studentNo})` : "미등록 토큰"} / {log.actionType}
              </p>
              <p className="muted">
                {formatDate(log.scannedAt)} {formatTime(log.scannedAt)} · {log.deviceId} ·{" "}
                {log.operator?.name ?? "운영자 미지정"}
              </p>
            </div>
            <span className={`status-pill ${log.isValid ? "status-completed" : "status-missing_checkin"}`}>
              {log.isValid ? "유효" : log.invalidReason ?? "무효"}
            </span>
          </article>
        ))}
        {logs.length === 0 ? <p className="muted">기록이 없습니다.</p> : null}
      </div>
    </section>
  );
}

export function ManualAdjustmentFeed({
  adjustments,
}: {
  adjustments: ManualAdjustmentWithRelations[];
}) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">예외 이력</p>
          <h2>최근 수동 처리</h2>
        </div>
      </div>
      <div className="log-list">
        {adjustments.map((item: ManualAdjustmentWithRelations) => (
          <article className="log-item" key={item.id}>
            <div>
              <p className="log-title">
                {item.student.name} ({item.student.studentNo}) / {item.actionType}
              </p>
              <p className="muted">
                {formatDate(item.createdAt)} {formatTime(item.createdAt)} · {item.reason} · {item.operator.name}
              </p>
            </div>
            <span className="badge">{item.student.studentNo}</span>
          </article>
        ))}
        {adjustments.length === 0 ? <p className="muted">수동 처리 기록이 없습니다.</p> : null}
      </div>
    </section>
  );
}
