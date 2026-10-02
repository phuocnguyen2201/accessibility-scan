"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeUrl, type Scan, type Site } from "@a11y/shared";
import { adminClient, guestLimits, limits } from "@/lib/supabase-admin";
import { isGuest, minutesUntil, nextGuestScanAt, requesterIpHash } from "@/lib/guest";
import { currentUser, serverClient } from "@/lib/supabase-server";

const NOT_SIGNED_IN = { ok: false as const, error: "Your session has expired. Please sign in again." };

export type CheckResult =
  | { ok: false; error: string }
  | { ok: true; exists: false; normalized: string }
  | { ok: true; exists: true; normalized: string; site: Site; lastScan: Scan | null };

/** Duplicate check: has the signed-in user already scanned this site (after normalization)? */
export async function checkSite(input: string): Promise<CheckResult> {
  const target = normalizeUrl(input);
  if (!target) return { ok: false, error: "Please enter a valid http(s) URL, e.g. example.com" };
  if (!(await currentUser())) return NOT_SIGNED_IN;

  // RLS on the user's own client restricts this lookup to their sites.
  const db = await serverClient();
  const { data: site, error } = await db.from("sites").select("*").eq("normalized_url", target.key).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!site) return { ok: true, exists: false, normalized: target.key };

  const { data: lastScan } = await db
    .from("scans")
    .select("*")
    .eq("site_id", site.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // All of the site's scans were deleted: treat it as new (the site row only keeps its false-positive markings).
  if (!lastScan) return { ok: true, exists: false, normalized: target.key };
  return { ok: true, exists: true, normalized: target.key, site, lastScan };
}

const startSchema = z.object({
  url: z.string().min(1),
  maxPages: z.coerce.number().int().min(1),
  lighthouseSample: z.coerce.number().int().min(0),
});

/** Creates the user's site if needed and queues a new scan. Re-scans add a new scan to the site's history. */
export async function startScan(input: z.input<typeof startSchema>): Promise<{ ok: true; scanId: string } | { ok: false; error: string }> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid scan options" };
  const target = normalizeUrl(parsed.data.url);
  if (!target) return { ok: false, error: "Please enter a valid http(s) URL" };
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

  const guest = isGuest(user);
  const maxPages = Math.min(parsed.data.maxPages, guest ? guestLimits.maxPages : limits.maxPagesCap);
  const lighthouseSample = Math.min(parsed.data.lighthouseSample, maxPages, guest ? guestLimits.lighthouseSample : Infinity);
  const db = adminClient();

  const { data: site, error: siteError } = await db
    .from("sites")
    .upsert({ user_id: user.id, normalized_url: target.key, display_url: target.url }, { onConflict: "user_id,normalized_url" })
    .select()
    .single();
  if (siteError) return { ok: false, error: siteError.message };

  // Don't start a second scan while one for the same site is still queued or running.
  const { data: active } = await db
    .from("scans")
    .select("id")
    .eq("site_id", site.id)
    .in("status", ["queued", "running"])
    .limit(1)
    .maybeSingle();
  if (active) return { ok: true, scanId: active.id };

  // Guests get one scan per cooldown window, per guest account and per network.
  const ipHash = guest ? await requesterIpHash() : null;
  if (ipHash) {
    const next = await nextGuestScanAt(user, ipHash);
    if (next) {
      return {
        ok: false,
        error: `Guests can start one scan every ${guestLimits.cooldownMinutes} minutes. Try again in ${minutesUntil(next)}, or create a free account to scan without waiting.`,
      };
    }
  }

  const { data: scan, error } = await db
    .from("scans")
    .insert({
      site_id: site.id,
      user_id: user.id,
      start_url: target.url,
      max_pages: maxPages,
      lighthouse_sample: lighthouseSample,
      requester_ip_hash: ipHash,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await db.from("sites").update({ last_scan_id: scan.id }).eq("id", site.id);
  return { ok: true, scanId: scan.id };
}

export async function cancelScan(scanId: string) {
  const user = await currentUser();
  if (!user) return;
  const db = adminClient();
  const { data } = await db.from("scans").select("status").eq("id", scanId).eq("user_id", user.id).maybeSingle();
  if (data?.status === "queued") {
    // Never picked up by a worker - nothing to wind down.
    await db.from("scans").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", scanId);
  } else if (data?.status === "running") {
    await db.from("scans").update({ status: "cancelled" }).eq("id", scanId);
  }
}

export async function requestLighthouse(pageId: string) {
  if (!(await currentUser())) return;
  // Only proceed if RLS lets this user see the page, i.e. it belongs to one of their scans.
  const { data: page } = await (await serverClient()).from("pages").select("id").eq("id", pageId).maybeSingle();
  if (!page) return;
  await adminClient()
    .from("pages")
    .update({ lighthouse_status: "queued", lighthouse_requested_at: new Date().toISOString() })
    .eq("id", pageId)
    .in("lighthouse_status", ["none", "failed", "done"]);
}

const dismissSchema = z.object({
  violationId: z.string().uuid(),
  scope: z.enum(["page", "site"]),
  reason: z.string().trim().max(500).optional(),
});

/**
 * Marks an axe rule as a false positive on this page or on every page of the site.
 * Applies to all scans of the site, including future re-scans.
 */
export async function dismissViolation(input: z.input<typeof dismissSchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = dismissSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

  // RLS: the user's client only returns the violation if it belongs to one of their scans.
  const { data: violation } = await (await serverClient())
    .from("violations")
    .select("rule_id, page:pages!inner(normalized_url), scan:scans!inner(id, site_id)")
    .eq("id", parsed.data.violationId)
    .maybeSingle<{ rule_id: string; page: { normalized_url: string }; scan: { id: string; site_id: string } }>();
  if (!violation) return { ok: false, error: "Issue not found" };

  const db = adminClient();
  const { error } = await db.from("dismissals").upsert(
    {
      site_id: violation.scan.site_id,
      user_id: user.id,
      rule_id: violation.rule_id,
      page_key: parsed.data.scope === "page" ? violation.page.normalized_url : "",
      reason: parsed.data.reason || null,
    },
    { onConflict: "site_id,rule_id,page_key" },
  );
  if (error) return { ok: false, error: error.message };

  const { error: applyError } = await db.rpc("apply_site_dismissals", { p_site_id: violation.scan.site_id });
  if (applyError) return { ok: false, error: applyError.message };
  revalidatePath(`/scans/${violation.scan.id}`, "layout");
  return { ok: true };
}

/** Removes a false-positive marking so the issue counts again. */
export async function restoreViolation(dismissalId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

  const { data: dismissal } = await (await serverClient())
    .from("dismissals")
    .select("id, site_id")
    .eq("id", dismissalId)
    .maybeSingle();
  if (!dismissal) return { ok: false, error: "Not found" };

  const db = adminClient();
  const { error } = await db.from("dismissals").delete().eq("id", dismissal.id).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  const { error: applyError } = await db.rpc("apply_site_dismissals", { p_site_id: dismissal.site_id });
  if (applyError) return { ok: false, error: applyError.message };
  revalidatePath("/scans", "layout");
  return { ok: true };
}

/**
 * Deletes one scan and all of its pages, issues and Lighthouse results (FK cascade).
 * The site row is kept, so its false-positive markings survive and apply to future scans.
 */
export async function deleteScan(scanId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

  const db = adminClient();
  const { data: scan } = await db.from("scans").select("id, site_id, status").eq("id", scanId).eq("user_id", user.id).maybeSingle();
  if (!scan) return { ok: false, error: "Scan not found" };
  if (scan.status === "running") return { ok: false, error: "This scan is still running. Cancel it first, then delete it." };

  const { error } = await db.from("scans").delete().eq("id", scan.id);
  if (error) return { ok: false, error: error.message };

  // Point the site at its newest remaining scan (null if none left).
  const { data: latest } = await db
    .from("scans")
    .select("id")
    .eq("site_id", scan.site_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  await db.from("sites").update({ last_scan_id: latest?.id ?? null }).eq("id", scan.site_id);

  revalidatePath("/");
  return { ok: true };
}
