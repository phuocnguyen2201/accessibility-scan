"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { readAccount } from "@/lib/account";
import { clearFailures, cookieSecure, lockedUntil, recordFailure } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, createSessionToken } from "@/lib/session";

export type LoginState = { error?: string };

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const ip = await clientIp();
  const until = lockedUntil(ip);
  if (until) return { error: `Too many failed attempts. Try again after ${new Date(until).toLocaleTimeString()}.` };

  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const account = await readAccount();
  if (!account) return { error: "No admin account yet. Run `npm run create-user` on the Pi first." };
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) {
    return { error: "ADMIN_SESSION_SECRET isn't set (at least 32 random characters)." };
  }

  // Always run the hash, so a wrong username takes as long as a wrong password.
  const passwordOk = await verifyPassword(password, account.passwordHash);
  if (!passwordOk || username !== account.username) {
    recordFailure(ip);
    return { error: "Wrong username or password." };
  }
  clearFailures(ip);
  const { token, maxAge } = createSessionToken(account);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: cookieSecure(), path: "/", maxAge });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
