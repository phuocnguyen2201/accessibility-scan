import type { ExportData } from "./load";
import { auditGroups, checksLabel, has, lighthouseWithoutAudits, reportTitle, ruleGroups, seoGroups, splitLinks } from "./rows";

const PAGES_PER_FINDING = 5;
const EXAMPLES_PER_RULE = 2;
const MAX_PAGE_ROWS = 300;

/** Everything from the scanned site (titles, URLs, HTML snippets) is untrusted: escape it all. */
export const esc = (v: unknown) =>
  v == null
    ? ""
    : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const tone = (score: number | null | undefined) => (score == null ? "none" : score >= 90 ? "good" : score >= 50 ? "ok" : "bad");
const link = (url: string | null, label = url) =>
  url && /^https?:\/\//i.test(url) ? `<a href="${esc(url)}">${esc(label)}</a>` : esc(label);

const CSS = `
  * { box-sizing: border-box; }
  body { font: 10pt/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4px; }
  h2 { font-size: 13pt; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; break-after: avoid; }
  h3 { font-size: 10.5pt; margin: 14px 0 4px; break-after: avoid; }
  p, ul { margin: 4px 0; }
  ul { padding-left: 18px; }
  a { color: #1d4ed8; word-break: break-all; }
  .muted { color: #475569; }
  .small { font-size: 8.5pt; }
  .cards { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; min-width: 110px; }
  .card .label { font-size: 8pt; color: #475569; text-transform: uppercase; letter-spacing: .03em; }
  .card .value { font-size: 16pt; font-weight: 700; }
  .good { color: #166534; } .ok { color: #92400e; } .bad { color: #b91c1c; } .none { color: #475569; }
  .finding { break-inside: avoid; border-left: 3px solid #cbd5e1; padding: 2px 0 2px 10px; margin: 10px 0; }
  .impact { display: inline-block; font-size: 8pt; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; margin-right: 6px; }
  .impact.critical { background: #fee2e2; color: #991b1b; } .impact.serious { background: #ffedd5; color: #9a3412; }
  .impact.moderate { background: #fef3c7; color: #92400e; } .impact.minor, .impact.unknown { background: #f1f5f9; color: #334155; }
  code, pre { font: 8.5pt/1.4 Consolas, "SFMono-Regular", Menlo, monospace; }
  code { background: #f1f5f9; padding: 0 3px; border-radius: 3px; word-break: break-all; }
  pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; white-space: pre-wrap; word-break: break-all; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th, td { text-align: left; padding: 3px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { background: #f1f5f9; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
`;

function scoreCards(data: ExportData) {
  const s = data.summary;
  const cards: string[] = [];
  const card = (label: string, value: unknown, cls = "") =>
    `<div class="card"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value ?? "-")}</div></div>`;
  if (has(data, "accessibility")) cards.push(card("Accessibility", s?.avg_a11y, tone(s?.avg_a11y)));
  if (has(data, "seo")) cards.push(card("SEO", s?.avg_seo, tone(s?.avg_seo)));
  if (has(data, "performance")) cards.push(card("Performance", s?.avg_perf, tone(s?.avg_perf)));
  cards.push(card("Pages scanned", s?.scanned_pages ?? data.scan.pages_scanned));
  if (has(data, "accessibility") && s) {
    cards.push(card("Critical elements", s.impact_counts.critical, s.impact_counts.critical ? "bad" : "good"));
    cards.push(card("Serious elements", s.impact_counts.serious, s.impact_counts.serious ? "ok" : "good"));
  }
  return `<div class="cards">${cards.join("")}</div>`;
}

function pageList(items: { url: string; note: string }[], total: number) {
  const shown = items.slice(0, PAGES_PER_FINDING).map((p) => `<li>${link(p.url)}${p.note ? ` <span class="muted">(${esc(p.note)})</span>` : ""}</li>`);
  if (total > PAGES_PER_FINDING) shown.push(`<li class="muted">... and ${plural(total - PAGES_PER_FINDING, "more page")} (see the Excel report)</li>`);
  return `<ul class="small">${shown.join("")}</ul>`;
}

function accessibilitySection(data: ExportData) {
  const groups = ruleGroups(data, EXAMPLES_PER_RULE);
  if (!groups.length) return `<h2>Accessibility issues</h2><p>No accessibility issues found.</p>`;
  const parts = groups.map((g) => {
    const examples = g.examples
      .map(
        ({ page, node }) => `
        <p class="small">Element <code>${esc(node.target)}</code> on ${link(page.url)}</p>
        <pre>${esc(node.html)}</pre>
        ${node.failureSummary ? `<pre>${esc(node.failureSummary)}</pre>` : ""}`,
      )
      .join("");
    return `
      <div class="finding">
        <h3><span class="impact ${esc(g.impact ?? "unknown")}">${esc(g.impact ?? "unknown")}</span>${esc(g.help)} <code>${esc(g.rule_id)}</code></h3>
        <p>${esc(g.description)}</p>
        <p class="small muted">${plural(g.elements, "element")} on ${plural(g.pages.length, "page")}${g.wcag_tags.length ? ` · ${esc(g.wcag_tags.join(", "))}` : ""}${
          g.help_url ? ` · ${link(g.help_url, "How to fix")}` : ""
        }</p>
        ${pageList(g.pages.map((p) => ({ url: p.page.url, note: plural(p.elements, "element") })), g.pages.length)}
        ${examples}
      </div>`;
  });
  return `<h2>Accessibility issues (${plural(groups.length, "rule")})</h2>${parts.join("")}`;
}

function seoSection(data: ExportData) {
  const groups = seoGroups(data);
  if (!groups.length) return `<h2>SEO issues</h2><p>All on-page SEO checks passed.</p>`;
  const parts = groups.map(
    (g) => `
      <div class="finding">
        <h3>${esc(g.label)} <span class="muted small">fails on ${plural(g.pages.length, "page")}</span></h3>
        ${g.fix ? `<p><strong>Fix:</strong> ${esc(g.fix)}${g.url ? ` ${link(g.url, "Learn more")}` : ""}</p>` : ""}
        ${pageList(g.pages.map((p) => ({ url: p.page.url, note: p.detail })), g.pages.length)}
      </div>`,
  );
  return `<h2>SEO issues</h2>${parts.join("")}`;
}

function lighthouseSection(data: ExportData) {
  if (!data.lighthouse.size) return "";
  const groups = auditGroups(data);
  const stale = lighthouseWithoutAudits(data)
    ? `<p class="muted small">Some pages were audited before fix suggestions were stored. Re-run Lighthouse on them to include their findings.</p>`
    : "";
  if (!groups.length) return `<h2>Lighthouse findings</h2>${stale}<p>No failing Lighthouse audits.</p>`;
  const parts = groups.map((g) => {
    const { text, url, label } = splitLinks(g.description);
    const savings = [g.maxSavingsMs ? `up to ${g.maxSavingsMs} ms` : null, g.maxSavingsBytes ? `up to ${Math.round(g.maxSavingsBytes / 1000)} KB` : null]
      .filter(Boolean)
      .join(", ");
    return `
      <div class="finding">
        <h3>${esc(g.title)} <span class="muted small">${esc(g.category)}${savings ? ` · est. savings ${esc(savings)}` : ""}</span></h3>
        <p>${esc(text)}${url ? ` ${link(url, label ?? "Learn more")}` : ""}</p>
        ${pageList(g.pages.map((p) => ({ url: p.page.url, note: p.audit.displayValue ?? "" })), g.pages.length)}
      </div>`;
  });
  return `<h2>Lighthouse findings (${plural(data.lighthouse.size, "page")} audited)</h2>${stale}${parts.join("")}`;
}

function pagesSection(data: ExportData) {
  const cols: { label: string; num?: boolean; value: (p: ExportData["pages"][number]) => unknown }[] = [
    { label: "URL", value: (p) => p.url },
    { label: "HTTP", num: true, value: (p) => p.http_status ?? p.crawl_status },
  ];
  if (has(data, "accessibility")) {
    cols.push({ label: "Accessibility", num: true, value: (p) => p.a11y_score }, { label: "Issues", num: true, value: (p) => p.violation_count });
  }
  if (has(data, "seo")) cols.push({ label: "SEO", num: true, value: (p) => p.seo_score });
  if (has(data, "performance")) cols.push({ label: "Perf.", num: true, value: (p) => (p.perf_score == null ? null : `${p.perf_score}${p.perf_estimated ? "*" : ""}`) });
  const rows = data.pages
    .slice(0, MAX_PAGE_ROWS)
    .map((p) => `<tr>${cols.map((c) => `<td${c.num ? ' class="num"' : ""}>${esc(c.value(p) ?? "-")}</td>`).join("")}</tr>`);
  const more = data.pages.length > MAX_PAGE_ROWS ? `<p class="muted small">First ${MAX_PAGE_ROWS} of ${data.pages.length} pages; the Excel report has all of them.</p>` : "";
  return `<h2>Pages</h2>
    <table><thead><tr>${cols.map((c) => `<th${c.num ? ' class="num"' : ""}>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>
    ${more}${has(data, "performance") ? `<p class="muted small">* Performance estimated from page timings (Lighthouse didn't run on this page).</p>` : ""}`;
}

/** Self-contained, print-styled report (no external assets); the worker renders it to PDF with Chromium. */
export function reportHtml(data: ExportData) {
  const s = data.scan;
  const when = s.finished_at ?? s.started_at ?? s.created_at;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(reportTitle(data))}</title><style>${CSS}</style></head>
<body>
  <h1>${esc(reportTitle(data))}</h1>
  <p class="muted">${link(s.start_url)} · ${esc(new Date(when).toUTCString())} · ${esc(checksLabel(data))}</p>
  ${scoreCards(data)}
  ${data.summary?.dismissed_violations ? `<p class="muted small">${plural(data.summary.dismissed_violations, "element")} marked as false positive are excluded.</p>` : ""}
  ${has(data, "accessibility") ? accessibilitySection(data) : ""}
  ${has(data, "seo") ? seoSection(data) : ""}
  ${lighthouseSection(data)}
  ${pagesSection(data)}
</body></html>`;
}
