import "server-only";
import { readFile } from "node:fs/promises";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminFile } from "./account";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** Guard for every page and route handler (the proxy checks too; this is the second lock). */
export async function requireAdmin() {
  const user = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login");
  return user;
}

export const cookieSecure = () => process.env.ADMIN_COOKIE_SECURE === "true";

// ---------------------------------------------------------------- login throttling
// In memory: the admin app is a single process on the Pi. 5 failures from one address lock it for 15 minutes.

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
const failures = new Map<string, { count: number; until: number }>();

export function lockedUntil(ip: string) {
  const f = failures.get(ip);
  return f && f.count >= MAX_FAILURES && f.until > Date.now() ? f.until : null;
}

export function recordFailure(ip: string) {
  const f = failures.get(ip);
  const fresh = !f || f.until < Date.now();
  failures.set(ip, { count: fresh ? 1 : f.count + 1, until: Date.now() + LOCK_MS });
}

export const clearFailures = (ip: string) => failures.delete(ip);

/** For the login page: whether the account file exists yet. */
export async function accountExists() {
  try {
    await readFile(adminFile());
    return true;
  } catch {
    return false;
  }
}
