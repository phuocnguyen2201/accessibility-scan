import type { LighthouseAudit } from "@a11y/shared";

const CATEGORIES = ["performance", "seo", "best-practices"] as const;
const MAX_ITEMS = 5;
const MAX_FIELDS = 6;
const MAX_TEXT = 300;

// Loosely typed slice of Lighthouse's result: we only read a few fields, and the full types change between versions.
interface Lhr {
  categories: Record<string, { auditRefs: { id: string; group?: string }[] } | undefined>;
  audits: Record<string, RawAudit | undefined>;
}
interface RawAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  metricSavings?: Record<string, number | undefined>;
  details?: {
    type?: string;
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
    headings?: { key?: string | null; valueType?: string; label?: unknown }[];
    items?: Record<string, unknown>[];
  };
}

/**
 * The failing audits worth acting on, with Lighthouse's own fix text.
 * Accessibility is left out: Lighthouse runs axe for it, and axe results are stored per element already.
 * The metric audits (LCP, TBT, ...) are left out too: their values are stored as numbers.
 */
export function extractAudits(lhr: Lhr, categories: readonly string[]): LighthouseAudit[] {
  const out: LighthouseAudit[] = [];
  const seen = new Set<string>();
  for (const category of CATEGORIES) {
    if (!categories.includes(category)) continue;
    for (const ref of lhr.categories[category]?.auditRefs ?? []) {
      if (ref.group === "metrics" || seen.has(ref.id)) continue;
      const a = lhr.audits[ref.id];
      if (!a || !isFailing(a)) continue;
      seen.add(ref.id);
      out.push({
        id: a.id,
        category,
        title: a.title,
        description: a.description,
        displayValue: a.displayValue ?? null,
        score: a.score,
        savingsMs: round(a.details?.overallSavingsMs ?? a.metricSavings?.LCP ?? a.metricSavings?.FCP ?? a.metricSavings?.TBT),
        savingsBytes: round(a.details?.overallSavingsBytes),
        items: items(a),
      });
    }
  }
  // Biggest wins first: time saved, then bytes, then the lowest score.
  return out.sort(
    (x, y) => (y.savingsMs ?? 0) - (x.savingsMs ?? 0) || (y.savingsBytes ?? 0) - (x.savingsBytes ?? 0) || (x.score ?? 0) - (y.score ?? 0),
  );
}

function isFailing(a: RawAudit) {
  if (a.score == null) return false;
  if (a.scoreDisplayMode === "binary") return a.score < 1;
  if (a.scoreDisplayMode === "numeric" || a.scoreDisplayMode === "metricSavings") return a.score < 0.9;
  return false;
}

function items(a: RawAudit): Record<string, string | number>[] {
  const headings = (a.details?.headings ?? []).filter((h) => h.key).slice(0, MAX_FIELDS);
  return (a.details?.items ?? []).slice(0, MAX_ITEMS).map((item) => {
    const row: Record<string, string | number> = {};
    for (const h of headings) {
      const v = cell(item[h.key!]);
      if (v !== null) row[h.key!] = v;
    }
    return row;
  });
}

/** Flattens a Lighthouse table cell (plain values, URLs, nodes, source locations) to a short string or number. */
function cell(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === "number") return Math.round(v * 100) / 100;
  if (typeof v === "string") return v.slice(0, MAX_TEXT);
  if (typeof v !== "object") return String(v).slice(0, MAX_TEXT);
  const o = v as Record<string, unknown>;
  if (o.type === "node") return String(o.selector ?? o.snippet ?? o.nodeLabel ?? "").slice(0, MAX_TEXT) || null;
  if (o.type === "source-location") return `${o.url ?? ""}:${Number(o.line ?? 0) + 1}`.slice(0, MAX_TEXT);
  if (o.type === "url" || o.type === "link" || o.type === "code" || o.type === "text") return String(o.value ?? o.text ?? o.url ?? "").slice(0, MAX_TEXT) || null;
  return null;
}

const round = (n: number | undefined) => (n == null || !Number.isFinite(n) || n <= 0 ? null : Math.round(n));
