import { createClient } from "@supabase/supabase-js";
import type { PageRow, Scan } from "@a11y/shared";
import { config } from "./config";

export const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

export async function claimNextScan(workerId: string): Promise<Scan | null> {
  const rows = check(await db.rpc("claim_next_scan", { p_worker: workerId }), "claim_next_scan") as Scan[] | null;
  return rows?.[0] ?? null;
}

export async function claimNextPage(scanId: string): Promise<PageRow | null> {
  const rows = check(await db.rpc("claim_next_page", { p_scan_id: scanId }), "claim_next_page") as PageRow[] | null;
  return rows?.[0] ?? null;
}

export async function claimNextLighthouse(): Promise<PageRow | null> {
  const rows = check(await db.rpc("claim_next_lighthouse"), "claim_next_lighthouse") as PageRow[] | null;
  return rows?.[0] ?? null;
}

export async function enqueuePages(
  scanId: string,
  parentId: string | null,
  depth: number,
  links: { url: string; key: string }[],
): Promise<number> {
  if (!links.length) return 0;
  return check(
    await db.rpc("enqueue_pages", { p_scan_id: scanId, p_parent_id: parentId, p_depth: depth, p_links: links }),
    "enqueue_pages",
  ) as number;
}

/** Updates heartbeat + counters and returns the current scan status (to detect cancellation). */
export async function touchScan(scanId: string): Promise<string> {
  return check(await db.rpc("touch_scan", { p_scan_id: scanId }), "touch_scan") as string;
}

export async function updateScan(scanId: string, patch: Record<string, unknown>) {
  check(await db.from("scans").update(patch).eq("id", scanId), "update scan");
}

export async function updatePage(pageId: string, patch: Record<string, unknown>) {
  check(await db.from("pages").update(patch).eq("id", pageId), "update page");
}

export { check };
