import Link from "next/link";
import { ScanPanel } from "@/components/scan-panel";
import { getTodayEvent } from "@/lib/attendance";
import { formatTime } from "@/lib/time";

export default async function CheckOutPage() {
  const event = await getTodayEvent();

  return (
    <main className="shell">
      <div className="subnav">
        <Link href="/">대시보드</Link>
        <Link href="/teacher/check-in">체크인 화면</Link>
        <Link href="/admin/manual">예외 처리</Link>
      </div>
      <ScanPanel
        action="checkout"
        title="체크아웃 스캔"
        subtitle={
          event
            ? `허용 시간: ${formatTime(event.checkoutStartAt)} - ${formatTime(event.checkoutEndAt)}`
            : "활성 행사 없음"
        }
        deviceId="gate-b-01"
        operatorEmail="teacher2@school.local"
      />
    </main>
  );
}
