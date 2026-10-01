import type { Impact, PerfMetrics, SeoCheck, SeoRaw } from "./types";

export const IMPACT_WEIGHTS: Record<Impact, number> = {
  critical: 10,
  serious: 7,
  moderate: 3,
  minor: 1,
};

/** axe does not report an impact for passed rules, so each pass counts as a "moderate" rule. */
const PASS_WEIGHT = IMPACT_WEIGHTS.moderate;

/**
 * Accessibility score 0-100 from axe results, weighted by impact:
 *   score = passWeight / (passWeight + violationWeight) * 100
 */
export function computeA11yScore(passedRuleCount: number, violationImpacts: (Impact | null | undefined)[]): number {
  const passWeight = passedRuleCount * PASS_WEIGHT;
  const violationWeight = violationImpacts.reduce(
    (sum, impact) => sum + IMPACT_WEIGHTS[impact ?? "moderate"],
    0,
  );
  if (passWeight + violationWeight === 0) return 100;
  return Math.round((passWeight / (passWeight + violationWeight)) * 100);
}

export function runSeoChecks(raw: SeoRaw): SeoCheck[] {
  const titleLen = raw.title?.trim().length ?? 0;
  const descLen = raw.metaDescription?.trim().length ?? 0;
  const noindex = /noindex/i.test(raw.robotsMeta ?? "");
  return [
    {
      id: "http-status",
      label: "Page returns HTTP 200",
      passed: raw.httpStatus === 200,
      detail: `Status ${raw.httpStatus ?? "unknown"}`,
    },
    {
      id: "title",
      label: "Title is 10-60 characters",
      passed: titleLen >= 10 && titleLen <= 60,
      detail: titleLen ? `${titleLen} characters` : "Missing <title>",
    },
    {
      id: "meta-description",
      label: "Meta description is 50-160 characters",
      passed: descLen >= 50 && descLen <= 160,
      detail: descLen ? `${descLen} characters` : "Missing meta description",
    },
    {
      id: "h1",
      label: "Exactly one <h1>",
      passed: raw.h1Count === 1,
      detail: `${raw.h1Count} <h1> found`,
    },
    {
      id: "canonical",
      label: "Canonical link present",
      passed: !!raw.canonical,
      detail: raw.canonical ?? "Missing rel=canonical",
    },
    {
      id: "lang",
      label: "<html lang> attribute present",
      passed: !!raw.lang,
      detail: raw.lang ?? "Missing lang",
    },
    {
      id: "viewport",
      label: "Viewport meta tag present",
      passed: !!raw.viewport,
      detail: raw.viewport ?? "Missing viewport meta",
    },
    {
      id: "indexable",
      label: "Page is indexable (no noindex)",
      passed: !noindex,
      detail: raw.robotsMeta ? `robots: ${raw.robotsMeta}` : "No robots meta",
    },
    {
      id: "img-alt",
      label: "All images have alt text",
      passed: raw.imagesWithoutAlt === 0,
      detail: `${raw.imagesWithoutAlt} of ${raw.imageCount} images missing alt`,
    },
  ];
}

export function computeSeoScore(checks: SeoCheck[]): number {
  if (!checks.length) return 0;
  return Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);
}

/** 1 when value <= good, 0 when value >= poor, linear in between. */
function band(value: number | null | undefined, good: number, poor: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= good) return 1;
  if (value >= poor) return 0;
  return 1 - (value - good) / (poor - good);
}

/**
 * Estimated performance score from cheap navigation-timing metrics.
 * Used when Lighthouse has not run on a page; the UI labels it "estimated".
 */
export function estimatePerfScore(m: PerfMetrics): number {
  const parts: [number | null, number][] = [
    [band(m.ttfb, 800, 1800), 0.3],
    [band(m.load, 2500, 6000), 0.4],
    [band(m.transferSize, 1_000_000, 4_000_000), 0.2],
    [band(m.requestCount, 50, 150), 0.1],
  ];
  const valid = parts.filter(([v]) => v != null) as [number, number][];
  const totalWeight = valid.reduce((s, [, w]) => s + w, 0);
  if (!totalWeight) return 0;
  return Math.round((valid.reduce((s, [v, w]) => s + v * w, 0) / totalWeight) * 100);
}
