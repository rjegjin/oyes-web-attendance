import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function decodeBasicAuth(value: string) {
  const [, encoded = ""] = value.split(" ");

  try {
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    return {
      user: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function isAuthorized(
  authHeader: string | null,
  candidates: Array<{ user: string; password: string }>,
) {
  const credentials = authHeader ? decodeBasicAuth(authHeader) : null;

  if (!credentials) {
    return false;
  }

  return candidates.some(
    (candidate) =>
      credentials.user === candidate.user && credentials.password === candidate.password,
  );
}

export function proxy(req: NextRequest) {
  const basicAuth = req.headers.get("authorization");
  const url = req.nextUrl;
  const adminCredentials = {
    user: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "oyes1234",
  };
  const teacherCredentials = {
    user: process.env.TEACHER_USERNAME || "teacher",
    password: process.env.TEACHER_PASSWORD || "oyes-teacher",
  };

  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api/manual") ||
    url.pathname.startsWith("/api/students") ||
    url.pathname.startsWith("/api/export")
  ) {
    if (isAuthorized(basicAuth, [adminCredentials])) {
      return NextResponse.next();
    }

    return new NextResponse("Auth required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Secure Area"',
      },
    });
  }

  if (url.pathname.startsWith("/teacher") || url.pathname.startsWith("/api/scan")) {
    if (isAuthorized(basicAuth, [adminCredentials, teacherCredentials])) {
      return NextResponse.next();
    }

    return new NextResponse("Auth required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Teacher Scan Area"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/teacher/:path*",
    "/api/scan/:path*",
    "/api/manual/:path*",
    "/api/students/:path*",
    "/api/export/:path*",
  ],
};
