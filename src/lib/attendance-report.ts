import { FinalStatus } from "@/lib/attendance";

export type DashboardFilters = {
  status?: string;
  classNo?: string;
  q?: string;
};

export function normalizeFilterInput(filters: DashboardFilters) {
  return {
    status: filters.status?.trim().toUpperCase() || "",
    classNo: filters.classNo?.trim() || "",
    q: filters.q?.trim().toLowerCase() || "",
  };
}

export function matchesStudentFilter(
  student: { name: string; studentNo: string; classNo: number },
  status: FinalStatus,
  filters: DashboardFilters,
) {
  const normalized = normalizeFilterInput(filters);
  const textTarget = `${student.name} ${student.studentNo}`.toLowerCase();

  if (normalized.status && normalized.status !== status) {
    return false;
  }

  if (normalized.classNo && String(student.classNo) !== normalized.classNo) {
    return false;
  }

  if (normalized.q && !textTarget.includes(normalized.q)) {
    return false;
  }

  return true;
}
