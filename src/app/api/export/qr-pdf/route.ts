import { NextResponse } from "next/server";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
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

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

function drawQrMatrix(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  size: number,
) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const moduleCount = qr.modules.size;
  const cell = size / moduleCount;

  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    color: rgb(1, 1, 1),
  });

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.modules.get(row, col)) {
        page.drawRectangle({
          x: x + col * cell,
          y: y + (moduleCount - row - 1) * cell,
          width: Math.ceil(cell * 100) / 100,
          height: Math.ceil(cell * 100) / 100,
          color: rgb(0.07, 0.07, 0.07),
        });
      }
    }
  }
}

function drawStudentCard(
  page: PDFPage,
  font: PDFFont,
  student: PdfStudent,
  x: number,
  yTop: number,
  width: number,
  height: number,
) {
  const y = PAGE_HEIGHT - yTop - height;
  const qrSize = 82;
  const qrX = x + (width - qrSize) / 2;
  const qrY = y + 60;
  const centerText = (text: string, size: number) => x + (width - font.widthOfTextAtSize(text, size)) / 2;

  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0.81, 0.84, 0.83),
    borderWidth: 0.7,
    color: rgb(1, 1, 1),
  });

  page.drawText(`${student.grade}학년 ${student.classNo}반`, {
    x: centerText(`${student.grade}학년 ${student.classNo}반`, 8),
    y: y + height - 18,
    size: 8,
    font,
    color: rgb(0.37, 0.44, 0.43),
  });

  page.drawText(student.name, {
    x: centerText(student.name, 15),
    y: y + height - 43,
    size: 15,
    font,
    color: rgb(0.07, 0.07, 0.07),
  });

  page.drawText(student.studentNo, {
    x: centerText(student.studentNo, 8.5),
    y: y + height - 62,
    size: 8.5,
    font,
    color: rgb(0.37, 0.44, 0.43),
  });

  drawQrMatrix(page, student.qrToken, qrX, qrY, qrSize);

  page.drawText("OYES Attendance", {
    x: centerText("OYES Attendance", 7),
    y: y + 10,
    size: 7,
    font,
    color: rgb(0.48, 0.52, 0.51),
  });
}

export async function GET() {
  try {
    const cacheDir = path.join(os.tmpdir(), "oyes-web-attendance");
    await mkdir(cacheDir, { recursive: true });

    const cacheState = await prisma.student.aggregate({
      where: { isActive: true },
      _count: { _all: true },
      _max: { updatedAt: true },
    });
    const cacheKey = `${cacheState._count._all}-${cacheState._max.updatedAt?.toISOString() ?? "none"}`;
    const cachePath = path.join(cacheDir, `qr-pdf-${cacheKey}.pdf`);

    try {
      await stat(cachePath);
    } catch {
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

      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      const fontPath = path.join(process.cwd(), "public", "fonts", "DroidSansFallbackFull.ttf");
      const fontBytes = await readFile(fontPath);
      const font = await pdfDoc.embedFont(fontBytes);

      const columns = 3;
      const rows = 5;
      const gap = 8;
      const margin = 28;
      const cardWidth = (PAGE_WIDTH - margin * 2 - gap * (columns - 1)) / columns;
      const cardHeight = (PAGE_HEIGHT - margin * 2 - gap * (rows - 1)) / rows;

      let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

      for (const [index, student] of students.entries()) {
        if (index > 0 && index % (columns * rows) === 0) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        }

        const pageIndex = index % (columns * rows);
        const col = pageIndex % columns;
        const row = Math.floor(pageIndex / columns);
        const x = margin + col * (cardWidth + gap);
        const yTop = margin + row * (cardHeight + gap);

        drawStudentCard(page, font, student, x, yTop, cardWidth, cardHeight);
      }

      const bytes = await pdfDoc.save();
      await writeFile(cachePath, bytes);
    }

    const pdf = await readFile(cachePath);

    return new Response(pdf, {
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
