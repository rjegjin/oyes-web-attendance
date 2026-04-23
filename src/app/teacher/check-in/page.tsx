import Link from "next/link";
import { RecentScanFeed } from "@/components/recent-scan-feed";
import { ScanPanel } from "@/components/scan-panel";
import { getRecentScanLogs, getTodayEvent } from "@/lib/attendance";
import { formatTime } from "@/lib/time";

export default async function CheckInPage() {
  const [event, logs] = await Promise.all([getTodayEvent(), getRecentScanLogs("checkin", 10)]);
  const deviceId = process.env.TEACHER_CHECKIN_DEVICE_ID || "gate-a-01";
  const operatorEmail = process.env.TEACHER_CHECKIN_OPERATOR_EMAIL || "teacher1@school.local";

  return (
    <main className="shell">
      <div className="subnav">
        <Link href="/">대시보드</Link>
        <Link href="/teacher/check-out">체크아웃 화면</Link>
        <Link href="/admin/manual">예외 처리</Link>
        <Link href="/admin/logs">운영 로그</Link>
      </div>
      <section className="two-column">
        <ScanPanel
          action="checkin"
          title="체크인 스캔"
          subtitle={
            event
              ? `허용 시간: ${formatTime(event.checkinStartAt)} - ${formatTime(event.checkinEndAt)}`
              : "활성 행사 없음"
          }
          deviceId={deviceId}
          operatorEmail={operatorEmail}
        />
        <RecentScanFeed eyebrow="입장 현황" title="최근 체크인 로그" logs={logs} />
      </section>
    </main>
  );
}
