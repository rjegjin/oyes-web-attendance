import { createStudentQrToken } from "@/lib/student-token";
import { buildCsv, normalizeHeader, parseCsv } from "@/lib/csv";

export type StudentRosterRow = {
  studentNo: string;
  name: string;
  grade: number;
  classNo: number;
  photoUrl?: string | null;
};

export type StudentRosterWarningCode =
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_GRADE"
  | "INVALID_CLASS"
  | "DUPLICATE_STUDENT_NO";

export type StudentRosterWarning = {
  code: StudentRosterWarningCode;
  line: number;
  message: string;
};

export type StudentRosterParseResult = {
  rows: StudentRosterRow[];
  summary: {
    totalDataRows: number;
    acceptedRows: number;
    skippedRows: number;
    warningCount: number;
  };
  warnings: StudentRosterWarning[];
};

const HEADER_ALIASES: Record<keyof StudentRosterRow, string[]> = {
  studentNo: ["studentno", "학번", "번호"],
  name: ["name", "이름", "학생명"],
  grade: ["grade", "학년"],
  classNo: ["classno", "반", "학급"],
  photoUrl: ["photourl", "사진url", "photo"],
};

export function studentRosterTemplateCsv() {
  return buildCsv([
    ["학번", "이름", "학년", "반", "사진URL"],
    ["2026301", "홍길동", 2, 3, ""],
    ["2026302", "김민지", 2, 3, ""],
  ]);
}

function findHeaderIndex(headers: string[], aliases: string[]) {
  const normalized = headers.map((header) => normalizeHeader(header));
  return aliases.map((alias) => normalized.indexOf(normalizeHeader(alias))).find((index) => index >= 0);
}

function compactStudentNo(value: string) {
  return value.replaceAll(/\s+/g, "");
}

export function parseStudentRosterCsv(csvText: string): StudentRosterParseResult {
  const rows = parseCsv(csvText.trim());
  if (rows.length < 2) {
    throw new Error("명단 CSV에 데이터가 없습니다.");
  }

  const headers = rows[0];
  const indices = {
    studentNo: findHeaderIndex(headers, HEADER_ALIASES.studentNo),
    name: findHeaderIndex(headers, HEADER_ALIASES.name),
    grade: findHeaderIndex(headers, HEADER_ALIASES.grade),
    classNo: findHeaderIndex(headers, HEADER_ALIASES.classNo),
    photoUrl: findHeaderIndex(headers, HEADER_ALIASES.photoUrl),
  };

  if (
    indices.studentNo === undefined ||
    indices.name === undefined ||
    indices.grade === undefined ||
    indices.classNo === undefined
  ) {
    throw new Error("CSV 헤더는 최소 학번, 이름, 학년, 반을 포함해야 합니다.");
  }

  const roster: StudentRosterRow[] = [];
  const seen = new Set<string>();
  const warnings: StudentRosterWarning[] = [];

  for (const [offset, row] of rows.slice(1).entries()) {
    const line = offset + 2;
    const studentNo = compactStudentNo(row[indices.studentNo] ?? "");
    const name = row[indices.name]?.trim();
    const grade = Number(row[indices.grade]?.trim());
    const classNo = Number(row[indices.classNo]?.trim());
    const photoUrl = indices.photoUrl !== undefined ? row[indices.photoUrl]?.trim() : "";

    if (!studentNo || !name) {
      warnings.push({
        code: "MISSING_REQUIRED_FIELD",
        line,
        message: `${line}행: 학번 또는 이름이 비어 있어 건너뜀`,
      });
      continue;
    }

    if (!Number.isInteger(grade) || grade <= 0) {
      warnings.push({
        code: "INVALID_GRADE",
        line,
        message: `${line}행: 학년 값이 올바르지 않아 건너뜀`,
      });
      continue;
    }

    if (!Number.isInteger(classNo) || classNo <= 0) {
      warnings.push({
        code: "INVALID_CLASS",
        line,
        message: `${line}행: 반 값이 올바르지 않아 건너뜀`,
      });
      continue;
    }

    if (seen.has(studentNo)) {
      warnings.push({
        code: "DUPLICATE_STUDENT_NO",
        line,
        message: `${line}행: 중복 학번 ${studentNo} 건너뜀`,
      });
      continue;
    }

    seen.add(studentNo);
    roster.push({
      studentNo,
      name,
      grade,
      classNo,
      photoUrl: photoUrl || null,
    });
  }

  if (roster.length === 0) {
    throw new Error("유효한 학생 데이터가 없습니다.");
  }

  return {
    rows: roster,
    summary: {
      totalDataRows: rows.length - 1,
      acceptedRows: roster.length,
      skippedRows: warnings.length,
      warningCount: warnings.length,
    },
    warnings,
  };
}

export function buildStudentQrToken(studentNo: string, qrVersion = 1) {
  return createStudentQrToken(studentNo, qrVersion);
}
