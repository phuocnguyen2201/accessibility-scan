import "server-only";
import type { User } from "@supabase/supabase-js";
import { isGuest } from "./guest";
import { adminClient } from "./supabase-admin";

/** Premium users can run page counts. Granted per user in the profiles table; guests never are. */
export async function isPremium(user: User | null): Promise<boolean> {
  if (!user || isGuest(user)) return false;
  const { data } = await adminClient().from("profiles").select("is_premium").eq("user_id", user.id).maybeSingle();
  return !!data?.is_premium;
}
