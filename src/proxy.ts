import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const basicAuth = req.headers.get("authorization");
  const url = req.nextUrl;

  // 인증이 필요한 경로 확인 (admin 페이지 및 manual API)
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/manual")) {
    if (basicAuth) {
      const authValue = basicAuth.split(" ")[1];
      const [user, pwd] = atob(authValue).split(":");

      // TODO: 환경변수로 빼는 것을 권장합니다 (process.env.ADMIN_PASSWORD)
      const validUser = process.env.ADMIN_USERNAME || "admin";
      const validPassword = process.env.ADMIN_PASSWORD || "oyes1234";

      if (user === validUser && pwd === validPassword) {
        return NextResponse.next();
      }
    }

    url.pathname = "/api/auth";

    return new NextResponse("Auth required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Secure Area"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/manual/:path*"],
};
