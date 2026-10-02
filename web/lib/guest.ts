import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { adminClient, guestLimits } from "./supabase-admin";

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

/** "42 minutes" / "1 minute" until the given time (rounded up). */
export function minutesUntil(when: Date) {
  const m = Math.max(1, Math.ceil((when.getTime() - Date.now()) / 60_000));
  return `${m} minute${m === 1 ? "" : "s"}`;
}
