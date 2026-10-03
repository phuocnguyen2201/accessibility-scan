import type { SupabaseClient } from "@supabase/supabase-js";
import { SCAN_CHECKS, selectAll, type LighthouseRow, type PageRow, type Scan, type ScanCheck, type ScanSummary, type ViolationNode, type ViolationRow } from "@a11y/shared";

export type ExportPage = Omit<PageRow, "parent_page_id" | "attempts" | "content_type" | "a11y_passes">;
export type ExportIssue = Pick<ViolationRow, "page_id" | "rule_id" | "impact" | "help" | "description" | "help_url" | "wcag_tags" | "node_count"> & {
  /** The first few stored elements (not all of them: large scans would load hundreds of MB). */
  nodes: ViolationNode[];
};
export type ExportLighthouse = Omit<LighthouseRow, "created_at">;

export interface ExportData {
  scan: Scan & { site: { display_url: string; normalized_url: string } };
  summary: ScanSummary | null;
  /** The checks this scan ran (all of them for scans from before checks could be chosen). */
  checks: ScanCheck[];
  pages: ExportPage[];
  issues: ExportIssue[];
  lighthouse: Map<string, ExportLighthouse>;
}

/** Elements loaded per issue row. Enough examples for the reports; the dashboard pages through the rest. */
export const NODES_PER_ISSUE = 3;

const PAGE_COLUMNS =
  "id, scan_id, url, normalized_url, depth, crawl_status, http_status, title, a11y_score, seo_score, perf_score, perf_estimated, violation_count, critical_count, perf_metrics, seo_checks, lighthouse_status, error, scanned_at";
const ISSUE_COLUMNS = [
  "page_id, rule_id, impact, help, description, help_url, wcag_tags, node_count",
  ...Array.from({ length: NODES_PER_ISSUE }, (_, i) => `n${i}:nodes->${i}`),
].join(", ");

type IssueRow = Omit<ExportIssue, "nodes"> & Record<`n${number}`, ViolationNode | null>;

/**
 * Loads everything needed to export one scan. Pass the signed-in user's client in the web app (RLS: only
 * their own scans) or the service-role client in the worker. Issues marked as false positives are left out,
 * matching the dashboard. Returns null if the scan isn't visible.
 */
export async function loadExportData(db: SupabaseClient, scanId: string): Promise<ExportData | null> {
  const { data: scan } = await db
    .from("scans")
    .select("*, site:sites!scans_site_id_fkey(display_url, normalized_url)")
    .eq("id", scanId)
    .maybeSingle<ExportData["scan"]>();
  if (!scan) return null;

  const [pages, issues, lighthouse, stats] = await Promise.all([
    selectAll<ExportPage>((from, to) =>
      db.from("pages").select(PAGE_COLUMNS).eq("scan_id", scanId).order("depth").order("url").order("id").range(from, to),
    ),
    selectAll<IssueRow>((from, to) =>
      db
        .from("violations")
        .select(ISSUE_COLUMNS)
        .eq("scan_id", scanId)
        .is("dismissal_id", null)
        .order("id")
        .range(from, to)
        .overrideTypes<IssueRow[], { merge: false }>(),
    ),
    selectAll<ExportLighthouse>((from, to) =>
      db
        .from("lighthouse_results")
        .select("page_id, performance, accessibility, seo, best_practices, lcp, fcp, cls, tbt, speed_index, audits, page:pages!inner(scan_id)")
        .eq("page.scan_id", scanId)
        .order("page_id")
        .range(from, to),
    ),
    // A running scan has no stored summary yet; compute it live.
    scan.summary ? Promise.resolve({ data: scan.summary }) : db.rpc("scan_stats", { p_scan_id: scanId }),
  ]);

  return {
    scan,
    summary: (stats.data as ScanSummary | null) ?? null,
    checks: scan.checks?.length ? scan.checks : [...SCAN_CHECKS],
    pages,
    issues: issues.map(toIssue),
    lighthouse: new Map(lighthouse.map((l) => [l.page_id, l])),
  };
}

function toIssue(row: IssueRow): ExportIssue {
  const nodes: ViolationNode[] = [];
  const issue: Record<string, unknown> = { ...row };
  for (let i = 0; i < NODES_PER_ISSUE; i++) {
    const node = row[`n${i}`];
    if (node) nodes.push(node);
    delete issue[`n${i}`];
  }
  return { ...(issue as Omit<ExportIssue, "nodes">), nodes };
}

/** e.g. "site-scan_example.com_2026-10-02" */
export function exportBaseName(data: ExportData) {
  const site = data.scan.site.normalized_url.replace(/[^a-z0-9.-]+/gi, "_").replace(/_+$/, "");
  return `site-scan_${site}_${data.scan.created_at.slice(0, 10)}`;
}
