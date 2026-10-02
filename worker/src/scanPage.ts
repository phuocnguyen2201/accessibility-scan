import AxeBuilder from "@axe-core/playwright";
import type { Page } from "playwright";
import {
  computeA11yScore,
  computeSeoScore,
  estimatePerfScore,
  runSeoChecks,
  type Impact,
  type ScanCheck,
  type PerfMetrics,
  type SeoRaw,
  type ViolationNode,
} from "@a11y/shared";
import { config } from "./config";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const MAX_NODES = 25; // elements stored per rule per page (the UI pages through them one at a time)
const MAX_SNIPPET = 500;

export interface ViolationInsert {
  rule_id: string;
  impact: Impact | null;
  description: string;
  help: string;
  help_url: string | null;
  wcag_tags: string[];
  node_count: number;
  nodes: ViolationNode[];
}

export type ScanResult =
  | { kind: "skipped" | "http-error"; httpStatus: number | null; contentType: string | null; finalUrl: string; reason: string }
  | {
      kind: "done";
      finalUrl: string;
      httpStatus: number | null;
      contentType: string | null;
      title: string | null;
      // null when that check wasn't selected for the scan
      a11yScore: number | null;
      a11yPasses: number | null;
      seoScore: number | null;
      perfScore: number | null;
      perfMetrics: PerfMetrics | null;
      seoChecks: ReturnType<typeof runSeoChecks> | null;
      violations: ViolationInsert[];
      links: string[];
    };

interface Extracted {
  perf: PerfMetrics;
  seo: Omit<SeoRaw, "httpStatus">;
  links: string[];
}

// Runs inside the page. Kept as a plain string so the TS transpiler (tsx/esbuild)
// can't inject helpers like `__name` that don't exist in the browser.
const EXTRACT_SCRIPT = `(() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const resources = performance.getEntriesByType("resource");
  const meta = (sel) => document.querySelector(sel)?.content ?? null;
  const images = [...document.querySelectorAll("img")];
  return {
    perf: {
      ttfb: nav ? Math.round(nav.responseStart - nav.startTime) : null,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
      load: nav && nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd - nav.startTime) : null,
      transferSize: Math.round((nav?.transferSize ?? 0) + resources.reduce((s, r) => s + (r.transferSize || 0), 0)),
      requestCount: resources.length + 1,
    },
    seo: {
      title: document.title || null,
      metaDescription: meta('meta[name="description" i]'),
      h1Count: document.querySelectorAll("h1").length,
      canonical: document.querySelector('link[rel="canonical" i]')?.href ?? null,
      lang: document.documentElement.getAttribute("lang"),
      viewport: meta('meta[name="viewport" i]'),
      robotsMeta: meta('meta[name="robots" i]'),
      imageCount: images.length,
      imagesWithoutAlt: images.filter((i) => !i.hasAttribute("alt")).length,
    },
    links: [...document.querySelectorAll("a[href]")]
      .filter((a) => !/nofollow/i.test(a.rel))
      .map((a) => a.href),
  };
})()`;

export async function scanPage(page: Page, url: string, checks: ScanCheck[]): Promise<ScanResult> {
  const response = await page.goto(url, { waitUntil: "load", timeout: config.pageTimeoutMs });
  // Give client-rendered pages a moment to settle, but don't wait forever on chatty sites.
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

  const httpStatus = response?.status() ?? null;
  const contentType = response?.headers()["content-type"] ?? null;
  const finalUrl = page.url();

  if (httpStatus != null && httpStatus >= 400) {
    return { kind: "http-error", httpStatus, contentType, finalUrl, reason: `HTTP ${httpStatus}` };
  }
  if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
    return { kind: "skipped", httpStatus, contentType, finalUrl, reason: `Not HTML (${contentType})` };
  }

  const runA11y = checks.includes("accessibility");
  const runSeo = checks.includes("seo");
  const runPerf = checks.includes("performance");

  const axe = runA11y ? await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze() : null;

  // Always extracted: the links drive the crawl, and the title labels the page.
  const { perf, seo, links } = await page.evaluate<Extracted>(EXTRACT_SCRIPT);

  const seoRaw: SeoRaw = { ...seo, httpStatus };
  const seoChecks = runSeo ? runSeoChecks(seoRaw) : null;

  const violations: ViolationInsert[] = (axe?.violations ?? []).map((v) => ({
    rule_id: v.id,
    impact: (v.impact as Impact | null | undefined) ?? null,
    description: v.description,
    help: v.help,
    help_url: v.helpUrl ?? null,
    wcag_tags: v.tags.filter((t) => t.startsWith("wcag") || t === "best-practice"),
    node_count: v.nodes.length,
    nodes: v.nodes.slice(0, MAX_NODES).map((n) => ({
      target: n.target.map(String).join(" "),
      html: n.html.slice(0, MAX_SNIPPET),
      failureSummary: n.failureSummary?.slice(0, MAX_SNIPPET),
    })),
  }));

  return {
    kind: "done",
    finalUrl,
    httpStatus,
    contentType,
    title: seo.title,
    a11yPasses: axe ? axe.passes.length : null,
    a11yScore: axe
      ? computeA11yScore(
          axe.passes.length,
          violations.map((v) => v.impact),
        )
      : null,
    seoScore: seoChecks ? computeSeoScore(seoChecks) : null,
    perfScore: runPerf ? estimatePerfScore(perf) : null,
    perfMetrics: runPerf ? perf : null,
    seoChecks,
    violations,
    links: [...new Set(links)],
  };
}
