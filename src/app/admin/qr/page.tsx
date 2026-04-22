import Link from "next/link";
import { prisma } from "@/lib/prisma";
import QRCode from "react-qr-code";
import { PrintButton } from "./print-button";

export default async function QRPrintPage() {
  const students = await prisma.student.findMany({
    where: { isActive: true },
    orderBy: [{ grade: "asc" }, { classNo: "asc" }, { name: "asc" }],
  });

  return (
    <main className="shell qr-print-page">
      <div className="subnav print-hidden">
        <Link href="/">대시보드</Link>
        <Link href="/admin/manual">수동 처리</Link>
      </div>

      <section className="panel print-hidden">
        <div className="section-header">
          <div>
            <p className="eyebrow">QR 코드 출력</p>
            <h1>학생용 QR 코드 인쇄</h1>
          </div>
          <PrintButton />
        </div>
        <p className="muted">
          학생 배부용 QR 코드입니다. 브라우저의 인쇄 기능을 사용하여 출력하세요. (여백: 없음 권장)
        </p>
      </section>

      <div className="qr-grid">
        {students.map((student) => (
          <div key={student.id} className="qr-card">
            <div className="qr-header">
              <span className="qr-grade">{student.grade}학년 {student.classNo}반</span>
              <h2 className="qr-name">{student.name}</h2>
              <span className="qr-no">{student.studentNo}</span>
            </div>
            <div className="qr-code-wrapper">
              <QRCode value={student.qrToken} size={140} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
