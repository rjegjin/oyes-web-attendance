import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 120;

type PdfStudent = {
  studentNo: string;
  name: string;
  grade: number;
  classNo: number;
  qrToken: string;
};

function drawQrMatrix(doc: PDFKit.PDFDocument, value: string, x: number, y: number, size: number) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const moduleCount = qr.modules.size;
  const cell = size / moduleCount;

  doc.save();
  doc.rect(x, y, size, size).fill("#ffffff");
  doc.fillColor("#111111");

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.modules.get(row, col)) {
        doc.rect(x + col * cell, y + row * cell, Math.ceil(cell * 100) / 100, Math.ceil(cell * 100) / 100).fill();
      }
    }
  }

  doc.restore();
}

function drawStudentCard(doc: PDFKit.PDFDocument, student: PdfStudent, x: number, y: number, width: number, height: number) {
  const qrSize = 82;
  const qrX = x + (width - qrSize) / 2;

  doc
    .roundedRect(x, y, width, height, 10)
    .lineWidth(0.7)
    .strokeColor("#cfd6d4")
    .stroke();

  doc
    .font("Korean")
    .fontSize(8)
    .fillColor("#5f6f6d")
    .text(`${student.grade}학년 ${student.classNo}반`, x + 10, y + 10, { width: width - 20, align: "center" });

  doc
    .font("Korean")
    .fontSize(15)
    .fillColor("#111111")
    .text(student.name, x + 10, y + 25, { width: width - 20, align: "center" });

  doc
    .font("Korean")
    .fontSize(8.5)
    .fillColor("#5f6f6d")
    .text(student.studentNo, x + 10, y + 46, { width: width - 20, align: "center" });

  drawQrMatrix(doc, student.qrToken, qrX, y + 60, qrSize);

  doc
    .font("Korean")
    .fontSize(7)
    .fillColor("#7a8582")
    .text("OYES Attendance", x + 10, y + height - 16, { width: width - 20, align: "center" });
}

export async function GET() {
  try {
    const students = await prisma.student.findMany({
      where: { isActive: true },
      select: {
        studentNo: true,
        name: true,
        grade: true,
        classNo: true,
        qrToken: true,
      },
      orderBy: [{ grade: "asc" }, { classNo: "asc" }, { studentNo: "asc" }],
    });

    const doc = new PDFDocument({
      size: "A4",
      margin: 28,
      bufferPages: false,
      info: {
        Title: "OYES Student QR Codes",
        Author: "OYES Attendance",
      },
    });
    const fontPath = path.join(process.cwd(), "public", "fonts", "DroidSansFallbackFull.ttf");
    doc.registerFont("Korean", fontPath);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        doc.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
        doc.on("end", () => controller.close());
        doc.on("error", (error) => controller.error(error));
      },
    });

    const columns = 3;
    const rows = 5;
    const gap = 8;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 28;
    const cardWidth = (pageWidth - margin * 2 - gap * (columns - 1)) / columns;
    const cardHeight = (pageHeight - margin * 2 - gap * (rows - 1)) / rows;

    for (const [index, student] of students.entries()) {
      if (index > 0 && index % (columns * rows) === 0) {
        doc.addPage();
      }

      const pageIndex = index % (columns * rows);
      const col = pageIndex % columns;
      const row = Math.floor(pageIndex / columns);
      const x = margin + col * (cardWidth + gap);
      const y = margin + row * (cardHeight + gap);

      drawStudentCard(doc, student, x, y, cardWidth, cardHeight);
    }

    doc.end();

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="oyes-student-qr-${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "전체 QR 다운로드 실패",
      },
      { status: 500 },
    );
  }
}
