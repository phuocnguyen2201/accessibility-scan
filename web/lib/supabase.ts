import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Browser client carrying the signed-in user's session (from auth cookies),
 * so RLS limits every query and Realtime subscription to the user's own scans.
 */
export function browserClient(): SupabaseClient {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client;
}

export { selectAll } from "@a11y/shared";
