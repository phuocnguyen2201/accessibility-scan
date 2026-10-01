import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { serverClient } from "@/lib/supabase-server";

/**
 * Landing point for links in Supabase emails (sign-up verification, password reset).
 * Supports both link styles:
 *  - `?token_hash=...&type=...`  (recommended email template - works even if opened in another browser)
 *  - `?code=...`                  (default template / PKCE - must be opened in the browser that signed up)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await serverClient();
  let error: string | null = null;

  if (tokenHash && type) {
    const res = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    error = res.error?.message ?? null;
  } else if (code) {
    const res = await supabase.auth.exchangeCodeForSession(code);
    error = res.error?.message ?? null;
  } else {
    error = searchParams.get("error_description") ?? "Invalid or missing verification link.";
  }

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(`Link invalid or expired: ${error}`)}`);
  }
  const target = type === "recovery" ? "/auth/update-password" : next;
  return NextResponse.redirect(`${origin}${target}${target === "/" ? "?verified=1" : ""}`);
}
