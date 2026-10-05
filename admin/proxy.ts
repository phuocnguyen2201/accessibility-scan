import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";

/** Every route except /login needs a valid admin session. Pages and route handlers check again (requireAdmin). */
export async function proxy(request: NextRequest) {
  const user = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const path = request.nextUrl.pathname;
  if (path === "/login") return user ? NextResponse.redirect(new URL("/", request.url)) : withHeaders(NextResponse.next());
  if (!user) {
    if (path.startsWith("/api/") || path.startsWith("/export")) return withHeaders(new NextResponse("Unauthorized", { status: 401 }));
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return withHeaders(NextResponse.next());
}

function withHeaders(res: NextResponse) {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
