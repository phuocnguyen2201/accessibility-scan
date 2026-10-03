import type { LighthouseAudit } from "./fixes";

export type Impact = "critical" | "serious" | "moderate" | "minor";
export const IMPACTS: Impact[] = ["critical", "serious", "moderate", "minor"];

/** What a scan audits. "best-practices" only comes from Lighthouse, so it needs a Lighthouse sample. */
export const SCAN_CHECKS = ["accessibility", "seo", "performance", "best-practices"] as const;
export type ScanCheck = (typeof SCAN_CHECKS)[number];
export const SCAN_CHECK_LABELS: Record<ScanCheck, string> = {
  accessibility: "Accessibility",
  seo: "SEO",
  performance: "Performance",
  "best-practices": "Best practices",
};

export type ScanStatus ="queued" | "running" | "completed" | "failed" | "cancelled";
export type CrawlStatus = "pending" | "scanning" | "done" | "error" | "skipped";
export type LighthouseStatus = "none" | "queued" | "running" | "done" | "failed";

export interface PerfMetrics {
  ttfb: number | null;
  domContentLoaded: number | null;
  load: number | null;
  transferSize: number | null;
  requestCount: number | null;
}

export interface SeoRaw {
  httpStatus: number | null;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  canonical: string | null;
  lang: string | null;
  viewport: string | null;
  robotsMeta: string | null;
  imageCount: number;
  imagesWithoutAlt: number;
}

export interface SeoCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ViolationNode {
  /** Display selector; iframes and shadow roots are separated by " >>> ". */
  target: string;
  /** Selector per document / shadow root, as axe reports it (missing on older scans). */
  targetPath?: string[];
  html: string;
  failureSummary?: string;
}

export interface TopIssue {
  rule_id: string;
  help: string;
  impact: Impact | null;
  help_url: string | null;
  pages: number;
  nodes: number;
}

export interface ScanSummary {
  total_pages: number;
  scanned_pages: number;
  error_pages: number;
  avg_a11y: number | null;
  avg_seo: number | null;
  avg_perf: number | null;
  total_violations: number;
  /** Elements in issues marked as false positives (excluded from every other number). */
  dismissed_violations?: number;
  impact_counts: Record<Impact, number>;
  top_issues: TopIssue[];
}

export interface Site {
  id: string;
  user_id: string | null;
  normalized_url: string;
  display_url: string;
  created_at: string;
  last_scan_id: string | null;
}

export interface Scan {
  id: string;
  site_id: string;
  user_id: string | null;
  start_url: string;
  status: ScanStatus;
  phase: "crawling" | "lighthouse" | "finalizing" | null;
  max_pages: number;
  lighthouse_sample: number;
  checks: ScanCheck[];
  pages_found: number;
  pages_scanned: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  summary: ScanSummary | null;
  /** Email the reports to the owner when the scan completes (registered users only). */
  notify_email?: boolean;
  notified_at?: string | null;
  notify_error?: string | null;
}

export interface PageRow {
  id: string;
  scan_id: string;
  url: string;
  normalized_url: string;
  parent_page_id: string | null;
  depth: number;
  crawl_status: CrawlStatus;
  attempts: number;
  http_status: number | null;
  title: string | null;
  content_type: string | null;
  a11y_score: number | null;
  a11y_passes: number | null;
  seo_score: number | null;
  perf_score: number | null;
  perf_estimated: boolean;
  violation_count: number;
  critical_count: number;
  perf_metrics: PerfMetrics | null;
  seo_checks: SeoCheck[] | null;
  lighthouse_status: LighthouseStatus;
  error: string | null;
  scanned_at: string | null;
}

export interface ViolationRow {
  id: string;
  page_id: string;
  scan_id: string;
  rule_id: string;
  impact: Impact | null;
  description: string;
  help: string;
  help_url: string | null;
  wcag_tags: string[];
  node_count: number;
  nodes: ViolationNode[];
  dismissal_id: string | null;
}

export interface Dismissal {
  id: string;
  site_id: string;
  user_id: string;
  rule_id: string;
  /** Page dedupe key, or "" when the rule is dismissed on every page of the site. */
  page_key: string;
  reason: string | null;
  created_at: string;
}

export interface LighthouseRow {
  page_id: string;
  performance: number | null;
  accessibility: number | null;
  seo: number | null;
  best_practices: number | null;
  lcp: number | null;
  fcp: number | null;
  cls: number | null;
  tbt: number | null;
  speed_index: number | null;
  /** Failing performance / SEO / best-practices audits (null on results from before this was stored). */
  audits?: LighthouseAudit[] | null;
  created_at: string;
}
