import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client for server actions. Never import from client components. */
export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const limits = {
  maxPagesCap: Number(process.env.MAX_PAGES_CAP) || 800,
  defaultMaxPages: Number(process.env.DEFAULT_MAX_PAGES) || 800,
  defaultLighthouseSample: Number(process.env.DEFAULT_LIGHTHOUSE_SAMPLE) || 50,
  /** Scans a signed-in user may start per rolling 24 hours (guests have their own cooldown). */
  dailyScans: Number(process.env.DAILY_SCAN_LIMIT) || 15,
  /** Minimum gap between on-demand Lighthouse runs on the same page. */
  lighthouseCooldownMinutes: Number(process.env.LIGHTHOUSE_COOLDOWN_MINUTES) || 10,
};

/** Limits for guests (anonymous users): one scan per cooldown window, smaller scans. */
export const guestLimits = {
  cooldownMinutes: Number(process.env.GUEST_SCAN_COOLDOWN_MINUTES) || 60,
  maxPages: Math.min(Number(process.env.GUEST_MAX_PAGES) || 100, limits.maxPagesCap),
  // 0 is valid here (no Lighthouse for guests), so only fall back when unset.
  lighthouseSample: process.env.GUEST_LIGHTHOUSE_SAMPLE ? Number(process.env.GUEST_LIGHTHOUSE_SAMPLE) : 5,
};
