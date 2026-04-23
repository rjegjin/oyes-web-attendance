import { NextResponse } from "next/server";
import { studentRosterTemplateCsv } from "@/lib/student-roster";

export async function GET() {
  return new NextResponse(studentRosterTemplateCsv(), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="student_roster_template.csv"',
    },
  });
}
