import { createStudentQrToken } from "@/lib/student-token";
import { buildCsv, normalizeHeader, parseCsv } from "@/lib/csv";

export type StudentRosterRow = {
  studentNo: string;
  name: string;
  gender: string;
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

const HEADER_ALIASES: Record<string, string[]> = {
  studentNo: ["studentno", "학번", "번호"],
  name: ["name", "이름", "학생명", "성명"],
  gender: ["gender", "성별", "성"],
  photoUrl: ["photourl", "사진url", "photo"],
};

export function studentRosterTemplateCsv() {
  return buildCsv([
    ["학번", "성명", "성별", "사진URL"],
    ["20301", "홍길동", "남", ""],
    ["20302", "김민지", "여", ""],
  ]);
}

function findHeaderIndex(headers: string[], aliases: string[]) {
  const normalized = headers.map((header) => normalizeHeader(header));
  return aliases.map((alias) => normalized.indexOf(normalizeHeader(alias))).find((index) => index >= 0);
}

function compactStudentNo(value: string) {
  return value.replaceAll(/\s+/g, "");
}

function parseGradeFromStudentNo(studentNo: string) {
  if (studentNo.length === 5) {
    return parseInt(studentNo.substring(0, 1), 10);
  } else if (studentNo.length === 4) {
    return parseInt(studentNo.substring(0, 1), 10);
  }
  return 1;
}

function parseClassNoFromStudentNo(studentNo: string) {
  if (studentNo.length === 5) {
    return parseInt(studentNo.substring(1, 3), 10);
  } else if (studentNo.length === 4) {
    return parseInt(studentNo.substring(1, 2), 10);
  }
  return 1;
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
    gender: findHeaderIndex(headers, HEADER_ALIASES.gender),
    photoUrl: findHeaderIndex(headers, HEADER_ALIASES.photoUrl),
  };

  if (
    indices.studentNo === undefined ||
    indices.name === undefined ||
    indices.gender === undefined
  ) {
    throw new Error("CSV 헤더는 최소 학번, 이름(또는 성명), 성별을 포함해야 합니다.");
  }

  const roster: StudentRosterRow[] = [];
  const seen = new Set<string>();
  const warnings: StudentRosterWarning[] = [];

  for (const [offset, row] of rows.slice(1).entries()) {
    const line = offset + 2;
    const studentNo = compactStudentNo(row[indices.studentNo] ?? "");
    const name = row[indices.name]?.trim();
    const gender = row[indices.gender]?.trim();
    const photoUrl = indices.photoUrl !== undefined ? row[indices.photoUrl]?.trim() : "";

    if (!studentNo || !name || !gender) {
      warnings.push({
        code: "MISSING_REQUIRED_FIELD",
        line,
        message: `${line}행: 학번, 이름(또는 성명) 또는 성별이 비어 있어 건너뜀`,
      });
      continue;
    }

    const grade = parseGradeFromStudentNo(studentNo);
    const classNo = parseClassNoFromStudentNo(studentNo);

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
      gender,
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
