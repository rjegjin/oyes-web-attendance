import { NextRequest, NextResponse } from "next/server";
import { processScan, type ScanAction } from "@/lib/attendance";
import { manualPayloadSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ action: string }>;
};

function parseBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }

  return request.formData().then((data) => Object.fromEntries(data.entries()));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { action } = await context.params;

  if (action !== "checkin" && action !== "checkout") {
    return NextResponse.json({ ok: false, message: "지원하지 않는 액션입니다." }, { status: 404 });
  }

  const payload = manualPayloadSchema.safeParse(await parseBody(request));

  if (!payload.success) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PAYLOAD", message: payload.error.issues[0]?.message ?? "잘못된 요청입니다." },
      { status: 400 },
    );
  }

  try {
    const result = await processScan({
      action: action as ScanAction,
      token: payload.data.token,
      deviceId: payload.data.deviceId,
      operatorEmail: payload.data.operatorEmail,
      manual: true,
      reason: payload.data.reason,
    });

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const url = new URL("/admin/manual", request.url);
      url.searchParams.set("status", result.ok ? "ok" : "error");
      url.searchParams.set("message", result.message);
      return NextResponse.redirect(url, 303);
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "SERVER_ERROR",
        message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
