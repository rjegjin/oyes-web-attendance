import Link from "next/link";
import { RecentScanFeed } from "@/components/recent-scan-feed";
import { ScanPanel } from "@/components/scan-panel";
import { getRecentScanLogs, getTodayEvent } from "@/lib/attendance";
import { formatTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function CheckOutPage() {
  const [event, logs] = await Promise.all([getTodayEvent(), getRecentScanLogs("checkout", 10)]);
  const deviceId = process.env.TEACHER_CHECKOUT_DEVICE_ID || "gate-b-01";
  const operatorEmail = process.env.TEACHER_CHECKOUT_OPERATOR_EMAIL || "teacher2@school.local";

  return (
    <main className="shell">
      <div className="subnav">
        <Link href="/">대시보드</Link>
        <Link href="/teacher/check-in">체크인 화면</Link>
        <Link href="/admin/manual">예외 처리</Link>
        <Link href="/admin/logs">운영 로그</Link>
      </div>
      <section className="two-column">
        <ScanPanel
          action="checkout"
          title="체크아웃 스캔"
          subtitle={
            event
              ? `허용 시간: ${formatTime(event.checkoutStartAt)} - ${formatTime(event.checkoutEndAt)}`
              : "활성 행사 없음"
          }
          deviceId={deviceId}
          operatorEmail={operatorEmail}
        />
        <RecentScanFeed eyebrow="퇴장 현황" title="최근 체크아웃 로그" logs={logs} />
      </section>
    </main>
  );
}
