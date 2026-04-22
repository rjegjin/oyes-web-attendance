import Link from "next/link";
import { ScanPanel } from "@/components/scan-panel";
import { getTodayEvent } from "@/lib/attendance";
import { formatTime } from "@/lib/time";

export default async function CheckInPage() {
  const event = await getTodayEvent();

  return (
    <main className="shell">
      <div className="subnav">
        <Link href="/">대시보드</Link>
        <Link href="/teacher/check-out">체크아웃 화면</Link>
        <Link href="/admin/manual">예외 처리</Link>
      </div>
      <ScanPanel
        action="checkin"
        title="체크인 스캔"
        subtitle={
          event
            ? `허용 시간: ${formatTime(event.checkinStartAt)} - ${formatTime(event.checkinEndAt)}`
            : "활성 행사 없음"
        }
        deviceId="gate-a-01"
        operatorEmail="teacher1@school.local"
      />
    </main>
  );
}
