import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { adminClient, guestLimits, limits } from "./supabase-admin";

/** Guests are Supabase anonymous users. */
export const isGuest = (user: User | null) => !!user?.is_anonymous;

/**
 * Hash of the client IP, so guest scans can be rate-limited per network without storing addresses.
 * Netlify sets x-nf-client-connection-ip; other proxies set x-forwarded-for / x-real-ip.
 */
export async function requesterIpHash() {
  const h = await headers();
  const ip =
    h.get("x-nf-client-connection-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  return createHash("sha256").update(`a11y-guest:${ip}`).digest("hex");
}

/**
 * When the guest may start their next scan, or null if they can scan now.
 * Counts every scan created in the window (including cancelled or failed ones), by this guest or from this IP.
 */
export async function nextGuestScanAt(user: User, ipHash: string): Promise<Date | null> {
  const since = new Date(Date.now() - guestLimits.cooldownMinutes * 60_000).toISOString();
  const { data } = await adminClient()
    .from("scans")
    .select("created_at")
    .or(`user_id.eq.${user.id},requester_ip_hash.eq.${ipHash}`)
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return new Date(new Date(data.created_at).getTime() + guestLimits.cooldownMinutes * 60_000);
}

/**
 * When a signed-in user may start their next scan, or null if they're under the daily limit.
 * Counts every scan created in the last 24 hours (including cancelled or failed ones).
 */
export async function nextUserScanAt(userId: string): Promise<Date | null> {
  const day = 24 * 60 * 60_000;
  const since = new Date(Date.now() - day).toISOString();
  const { data } = await adminClient()
    .from("scans")
    .select("created_at")
    .eq("user_id", userId)
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(limits.dailyScans);
  if (!data || data.length < limits.dailyScans) return null;
  // A slot frees up once the oldest scan in the window is 24 hours old.
  return new Date(new Date(data[0].created_at).getTime() + day);
}

/** "42 minutes" / "1 minute" until the given time (rounded up). */
export function minutesUntil(when: Date) {
  const m = Math.max(1, Math.ceil((when.getTime() - Date.now()) / 60_000));
  return `${m} minute${m === 1 ? "" : "s"}`;
}

/** Like minutesUntil, but "about 3 hours" once the wait is over an hour. */
export function waitText(when: Date) {
  const m = Math.ceil((when.getTime() - Date.now()) / 60_000);
  if (m <= 60) return minutesUntil(when);
  const h = Math.round(m / 60);
  return `about ${h} hour${h === 1 ? "" : "s"}`;
}
