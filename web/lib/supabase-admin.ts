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
};

/** Limits for guests (anonymous users): one scan per cooldown window, smaller scans. */
export const guestLimits = {
  cooldownMinutes: Number(process.env.GUEST_SCAN_COOLDOWN_MINUTES) || 60,
  maxPages: Math.min(Number(process.env.GUEST_MAX_PAGES) || 100, limits.maxPagesCap),
  // 0 is valid here (no Lighthouse for guests), so only fall back when unset.
  lighthouseSample: process.env.GUEST_LIGHTHOUSE_SAMPLE ? Number(process.env.GUEST_LIGHTHOUSE_SAMPLE) : 5,
};
