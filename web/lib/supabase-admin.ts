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
