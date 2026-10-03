import { SCAN_CHECK_LABELS, SEO_CHECK_FIXES, splitLinks, type Impact, type LighthouseAudit, type ScanCheck, type ViolationNode } from "@a11y/shared";
import type { ExportData, ExportIssue, ExportPage } from "./load";

export { splitLinks };

export type Cell = string | number | null;
export type Row = Record<string, Cell>;

const IMPACT_ORDER: Record<Impact, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
export const impactRank = (i: string | null) => IMPACT_ORDER[i as Impact] ?? 4;
export const round = (n: number | null | undefined) => (n == null ? null : Math.round(n));
export const has = (data: ExportData, check: ScanCheck) => data.checks.includes(check);
const lighthouseRan = (data: ExportData) => data.lighthouse.size > 0;

export const reportTitle = (data: ExportData) => `Site scan: ${data.scan.site.normalized_url}`;
export const checksLabel = (data: ExportData) => data.checks.map((c) => SCAN_CHECK_LABELS[c]).join(", ");

// ---------------------------------------------------------------- flat rows (Excel and CSV)

export function summaryRows(data: ExportData): [string, Cell][] {
  const s = data.summary;
  const rows: [string, Cell][] = [
    ["Site", data.scan.site.display_url],
    ["Checks", checksLabel(data)],
    ["Scan status", data.scan.status],
    ["Started", data.scan.started_at ?? data.scan.created_at],
    ["Finished", data.scan.finished_at],
    ["Pages found", s?.total_pages ?? data.scan.pages_found],
    ["Pages scanned", s?.scanned_pages ?? null],
    ["Pages with errors", s?.error_pages ?? null],
  ];
  if (has(data, "accessibility")) {
    rows.push(
      ["Avg accessibility score", s?.avg_a11y ?? null],
      ["Issue elements", s?.total_violations ?? null],
      ["Critical issues", s?.impact_counts.critical ?? null],
      ["Serious issues", s?.impact_counts.serious ?? null],
      ["Moderate issues", s?.impact_counts.moderate ?? null],
      ["Minor issues", s?.impact_counts.minor ?? null],
      ["Marked as false positive (excluded)", s?.dismissed_violations ?? 0],
    );
  }
  if (has(data, "seo")) rows.push(["Avg SEO score", s?.avg_seo ?? null]);
  if (has(data, "performance")) rows.push(["Avg performance score", s?.avg_perf ?? null]);
  if (lighthouseRan(data)) rows.push(["Pages audited by Lighthouse", data.lighthouse.size]);
  return rows;
}

export function pageRows(data: ExportData): Row[] {
  const a11y = has(data, "accessibility");
  const seo = has(data, "seo");
  const perf = has(data, "performance");
  const lhRan = lighthouseRan(data);
  return data.pages.map((p) => {
    const lh = data.lighthouse.get(p.id);
    const row: Row = { URL: p.url, Title: p.title ?? "", Depth: p.depth, Status: p.crawl_status, "HTTP status": p.http_status };
    if (a11y) {
      row["Accessibility score"] = p.a11y_score;
      row["Issues (elements)"] = p.violation_count;
      row["Critical (elements)"] = p.critical_count;
    }
    if (seo) {
      row["SEO score"] = p.seo_score;
      row["Failed SEO checks"] = (p.seo_checks ?? [])
        .filter((c) => !c.passed)
        .map((c) => c.label)
        .join("; ");
    }
    if (perf) {
      row["Performance score"] = p.perf_score;
      row["Performance estimated"] = p.perf_score == null ? "" : p.perf_estimated ? "yes" : "no";
      row["TTFB (ms)"] = round(p.perf_metrics?.ttfb);
      row["Load (ms)"] = round(p.perf_metrics?.load);
      row["Transfer size (KB)"] = p.perf_metrics?.transferSize == null ? null : Math.round(p.perf_metrics.transferSize / 1000);
      row.Requests = p.perf_metrics?.requestCount ?? null;
    }
    if (lhRan) {
      if (perf) {
        row["Lighthouse performance"] = lh?.performance ?? null;
        row["LCP (ms)"] = round(lh?.lcp);
        row["FCP (ms)"] = round(lh?.fcp);
        row["TBT (ms)"] = round(lh?.tbt);
        row.CLS = lh?.cls == null ? null : Number(lh.cls.toFixed(3));
        row["Speed Index (ms)"] = round(lh?.speed_index);
      }
      if (a11y) row["Lighthouse accessibility"] = lh?.accessibility ?? null;
      if (seo) row["Lighthouse SEO"] = lh?.seo ?? null;
      if (has(data, "best-practices")) row["Lighthouse best practices"] = lh?.best_practices ?? null;
    }
    row.Error = p.error ?? "";
    return row;
  });
}

const firstNode = (v: ExportIssue): ViolationNode | undefined => v.nodes[0];

export function issueRows(data: ExportData): Row[] {
  const urls = new Map(data.pages.map((p) => [p.id, p.url]));
  return [...data.issues]
    .sort((a, b) => impactRank(a.impact) - impactRank(b.impact) || a.rule_id.localeCompare(b.rule_id))
    .map((v) => ({
      "Page URL": urls.get(v.page_id) ?? "",
      Rule: v.rule_id,
      Impact: v.impact ?? "unknown",
      Issue: v.help,
      Description: v.description,
      Elements: v.node_count,
      "Example element": firstNode(v)?.target ?? "",
      "How to fix (axe-core)": firstNode(v)?.failureSummary ?? "",
      WCAG: v.wcag_tags.join(", "),
      Reference: v.help_url ?? "",
    }));
}

export function seoRows(data: ExportData): Row[] {
  return data.pages.flatMap((p) =>
    (p.seo_checks ?? [])
      .filter((c) => !c.passed)
      .map((c) => ({
        "Page URL": p.url,
        Check: c.label,
        Found: c.detail,
        "How to fix": SEO_CHECK_FIXES[c.id]?.fix ?? "",
        Reference: SEO_CHECK_FIXES[c.id]?.url ?? "",
      })),
  );
}

export function lighthouseAuditRows(data: ExportData): Row[] {
  return data.pages.flatMap((p) =>
    (data.lighthouse.get(p.id)?.audits ?? []).map((a) => {
      const { text, url } = splitLinks(a.description);
      return {
        "Page URL": p.url,
        Category: a.category,
        Audit: a.title,
        Result: a.displayValue ?? "",
        "Est. savings (ms)": a.savingsMs,
        "Est. savings (KB)": a.savingsBytes == null ? null : Math.round(a.savingsBytes / 1000),
        "How to fix (Lighthouse)": text,
        Reference: url ?? "",
      };
    }),
  );
}

// ---------------------------------------------------------------- grouped findings (Markdown and PDF)

export interface RuleGroup {
  rule_id: string;
  impact: Impact | null;
  help: string;
  description: string;
  help_url: string | null;
  wcag_tags: string[];
  elements: number;
  pages: { page: ExportPage; elements: number }[];
  examples: { page: ExportPage; node: ViolationNode }[];
}

/** Accessibility issues grouped by axe rule, most severe and widespread first. */
export function ruleGroups(data: ExportData, examplesPerRule = 3): RuleGroup[] {
  const pages = new Map(data.pages.map((p) => [p.id, p]));
  const groups = new Map<string, RuleGroup>();
  for (const v of data.issues) {
    const page = pages.get(v.page_id);
    if (!page) continue;
    let g = groups.get(v.rule_id);
    if (!g) {
      const { rule_id, impact, help, description, help_url, wcag_tags } = v;
      g = { rule_id, impact, help, description, help_url, wcag_tags, elements: 0, pages: [], examples: [] };
      groups.set(v.rule_id, g);
    }
    if (impactRank(v.impact) < impactRank(g.impact)) g.impact = v.impact;
    g.elements += v.node_count;
    g.pages.push({ page, elements: v.node_count });
    for (const node of v.nodes) if (g.examples.length < examplesPerRule) g.examples.push({ page, node });
  }
  for (const g of groups.values()) g.pages.sort((a, b) => b.elements - a.elements || a.page.url.localeCompare(b.page.url));
  return [...groups.values()].sort((a, b) => impactRank(a.impact) - impactRank(b.impact) || b.pages.length - a.pages.length || b.elements - a.elements);
}

export interface SeoGroup {
  id: string;
  label: string;
  fix: string | null;
  url: string | null;
  pages: { page: ExportPage; detail: string }[];
}

export function seoGroups(data: ExportData): SeoGroup[] {
  const groups = new Map<string, SeoGroup>();
  for (const page of data.pages) {
    for (const c of page.seo_checks ?? []) {
      if (c.passed) continue;
      let g = groups.get(c.id);
      if (!g) {
        g = { id: c.id, label: c.label, fix: SEO_CHECK_FIXES[c.id]?.fix ?? null, url: SEO_CHECK_FIXES[c.id]?.url ?? null, pages: [] };
        groups.set(c.id, g);
      }
      g.pages.push({ page, detail: c.detail });
    }
  }
  return [...groups.values()].sort((a, b) => b.pages.length - a.pages.length);
}

export interface AuditGroup {
  id: string;
  category: LighthouseAudit["category"];
  title: string;
  description: string;
  maxSavingsMs: number | null;
  maxSavingsBytes: number | null;
  pages: { page: ExportPage; audit: LighthouseAudit }[];
}

/** Failing Lighthouse audits grouped across the audited pages, biggest savings and most pages first. */
export function auditGroups(data: ExportData): AuditGroup[] {
  const groups = new Map<string, AuditGroup>();
  for (const page of data.pages) {
    for (const audit of data.lighthouse.get(page.id)?.audits ?? []) {
      let g = groups.get(audit.id);
      if (!g) {
        g = { id: audit.id, category: audit.category, title: audit.title, description: audit.description, maxSavingsMs: null, maxSavingsBytes: null, pages: [] };
        groups.set(audit.id, g);
      }
      g.pages.push({ page, audit });
      if (audit.savingsMs != null) g.maxSavingsMs = Math.max(g.maxSavingsMs ?? 0, audit.savingsMs);
      if (audit.savingsBytes != null) g.maxSavingsBytes = Math.max(g.maxSavingsBytes ?? 0, audit.savingsBytes);
    }
  }
  for (const g of groups.values()) g.pages.sort((a, b) => (b.audit.savingsMs ?? 0) - (a.audit.savingsMs ?? 0));
  return [...groups.values()].sort(
    (a, b) => (b.maxSavingsMs ?? 0) - (a.maxSavingsMs ?? 0) || b.pages.length - a.pages.length || (b.maxSavingsBytes ?? 0) - (a.maxSavingsBytes ?? 0),
  );
}

/** Lighthouse ran on some pages, but before audits were stored: the reports can't show its fix suggestions. */
export const lighthouseWithoutAudits = (data: ExportData) => [...data.lighthouse.values()].some((l) => l.audits == null);
