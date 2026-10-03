import type { ExportData } from "./load";
import { auditGroups, has, lighthouseWithoutAudits, reportTitle, ruleGroups, seoGroups, summaryRows } from "./rows";

const PAGES_PER_FINDING = 10;
const EXAMPLES_PER_RULE = 3;
const ITEMS_PER_AUDIT = 5;

/** Table cell: one line, pipes escaped. */
const cell = (value: unknown) => (value == null || value === "" ? "-" : String(value).replace(/\|/g, "\\|").replace(/\s+/g, " "));
/** Inline code that survives backticks in the content. */
const code = (s: string) => {
  const ticks = "`".repeat(Math.max(0, ...[...s.matchAll(/`+/g)].map((m) => m[0].length)) + 1);
  return `${ticks}${ticks.length > 1 ? ` ${s} ` : s}${ticks}`;
};
/** Fenced block that survives fences in the content (page HTML is untrusted). */
const fence = (s: string, lang = "") => {
  const ticks = "`".repeat(Math.max(2, ...[...s.matchAll(/`+/g)].map((m) => m[0].length)) + 1);
  return `${ticks}${lang}\n${s}\n${ticks}`;
};
const yamlString = (s: string) => JSON.stringify(s);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function table(header: string[], rows: unknown[][]) {
  return [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n");
}

function frontMatter(data: ExportData) {
  const s = data.summary;
  const lines = [
    "---",
    `site: ${yamlString(data.scan.site.normalized_url)}`,
    `start_url: ${yamlString(data.scan.start_url)}`,
    `scan_id: ${data.scan.id}`,
    `status: ${data.scan.status}`,
    `scanned_at: ${data.scan.finished_at ?? data.scan.started_at ?? data.scan.created_at}`,
    `checks: [${data.checks.join(", ")}]`,
    `pages_scanned: ${s?.scanned_pages ?? data.scan.pages_scanned}`,
  ];
  const scores: string[] = [];
  if (has(data, "accessibility")) scores.push(`accessibility: ${s?.avg_a11y ?? "null"}`);
  if (has(data, "seo")) scores.push(`seo: ${s?.avg_seo ?? "null"}`);
  if (has(data, "performance")) scores.push(`performance: ${s?.avg_perf ?? "null"}`);
  lines.push(`average_scores: { ${scores.join(", ")} }`);
  if (has(data, "accessibility") && s) {
    const c = s.impact_counts;
    lines.push(`accessibility_elements: { critical: ${c.critical}, serious: ${c.serious}, moderate: ${c.moderate}, minor: ${c.minor} }`);
  }
  lines.push("---");
  return lines.join("\n");
}

function howToUse(data: ExportData) {
  const steps = [
    `This is an automated scan of ${data.scan.site.normalized_url}. Use it to fix the site's source code. Work through the sections in order; each finding says what is wrong, where, and how to fix it.`,
    "",
  ];
  if (has(data, "accessibility")) {
    steps.push(
      "- **Accessibility** findings come from axe-core and are grouped by rule, most severe first. A rule failing on many pages usually lives in a shared template (header, footer, navigation, layout, a reused component): fix it there once.",
      "- Each example gives the element's CSS `selector` (` >>> ` marks an iframe or shadow-root boundary), its `html`, and axe-core's exact fix instruction. Any one of the options listed under \"Fix any of the following\" resolves it; every item under \"Fix all of the following\" is needed.",
      "- Fix the markup itself. Don't hide elements, add `aria-hidden`, or remove content just to make a rule pass.",
    );
  }
  if (has(data, "seo")) steps.push("- **SEO** findings come from on-page checks; each has the value found and the fix.");
  if (data.lighthouse.size) {
    steps.push("- **Lighthouse** findings (performance, SEO, best practices) were measured on a sample of pages and are ordered by estimated time saved.");
  }
  steps.push("- Issues marked as false positives in the dashboard are excluded. Re-scan after fixing to confirm.");
  return steps.join("\n");
}

function accessibilitySection(data: ExportData, out: string[]) {
  const groups = ruleGroups(data, EXAMPLES_PER_RULE);
  const elements = groups.reduce((n, g) => n + g.elements, 0);
  out.push(`## Accessibility issues (${plural(groups.length, "rule")}, ${plural(elements, "element")})`, "");
  if (!groups.length) {
    out.push("No accessibility issues found.", "");
    return;
  }
  groups.forEach((g, i) => {
    out.push(`### ${i + 1}. [${g.impact ?? "unknown"}] ${cell(g.help)} (${code(g.rule_id)})`, "");
    out.push(`- What's wrong: ${cell(g.description)}`);
    out.push(`- Affects: ${plural(g.elements, "element")} on ${plural(g.pages.length, "page")}`);
    if (g.wcag_tags.length) out.push(`- WCAG: ${g.wcag_tags.join(", ")}`);
    if (g.help_url) out.push(`- Reference: ${g.help_url}`);
    out.push("", "Pages:");
    for (const { page, elements: n } of g.pages.slice(0, PAGES_PER_FINDING)) out.push(`- ${page.url} (${plural(n, "element")})`);
    if (g.pages.length > PAGES_PER_FINDING) out.push(`- ... and ${plural(g.pages.length - PAGES_PER_FINDING, "more page")}`);
    out.push("");
    if (g.examples.length) {
      out.push("Examples:", "");
      g.examples.forEach(({ page, node }, j) => {
        out.push(`${j + 1}. Selector ${code(node.target)} on ${page.url}`, "");
        out.push(indent(fence(node.html, "html")), "");
        if (node.failureSummary) out.push(indent(fence(node.failureSummary, "text")), "");
      });
      if (g.elements > g.examples.length) out.push(`(${plural(g.elements - g.examples.length, "more element")} not shown; see the dashboard or the Excel export.)`, "");
    }
  });
}

const indent = (s: string) =>
  s
    .split("\n")
    .map((l) => `   ${l}`)
    .join("\n");

function seoSection(data: ExportData, out: string[]) {
  const groups = seoGroups(data);
  out.push(`## SEO issues (${plural(groups.length, "check")} failing)`, "");
  if (!groups.length) {
    out.push("All on-page SEO checks passed.", "");
    return;
  }
  for (const g of groups) {
    out.push(`### ${cell(g.label)}: fails on ${plural(g.pages.length, "page")}`, "");
    if (g.fix) out.push(`- Fix: ${g.fix}`);
    if (g.url) out.push(`- Reference: ${g.url}`);
    out.push("", "Pages:");
    for (const { page, detail } of g.pages.slice(0, PAGES_PER_FINDING)) out.push(`- ${page.url}: ${cell(detail)}`);
    if (g.pages.length > PAGES_PER_FINDING) out.push(`- ... and ${plural(g.pages.length - PAGES_PER_FINDING, "more page")}`);
    out.push("");
  }
}

function lighthouseSection(data: ExportData, out: string[]) {
  if (!data.lighthouse.size) return;
  const groups = auditGroups(data);
  out.push(`## Lighthouse findings (${plural(data.lighthouse.size, "page")} audited)`, "");
  if (lighthouseWithoutAudits(data)) {
    out.push("Some pages were audited before fix suggestions were stored. Re-run Lighthouse on them to include their findings.", "");
  }
  if (!groups.length) {
    out.push("No failing Lighthouse audits.", "");
    return;
  }
  for (const g of groups) {
    const savings = [g.maxSavingsMs ? `up to ${g.maxSavingsMs} ms` : null, g.maxSavingsBytes ? `up to ${Math.round(g.maxSavingsBytes / 1000)} KB` : null]
      .filter(Boolean)
      .join(", ");
    out.push(`### ${cell(g.title)} (${g.category}, ${code(g.id)})`, "");
    if (savings) out.push(`- Estimated savings: ${savings}`);
    out.push(`- How to fix: ${g.description.replace(/\s+/g, " ")}`);
    out.push("", "Pages:");
    for (const { page, audit } of g.pages.slice(0, PAGES_PER_FINDING)) out.push(`- ${page.url}${audit.displayValue ? `: ${cell(audit.displayValue)}` : ""}`);
    if (g.pages.length > PAGES_PER_FINDING) out.push(`- ... and ${plural(g.pages.length - PAGES_PER_FINDING, "more page")}`);
    const worst = g.pages[0]?.audit.items.slice(0, ITEMS_PER_AUDIT) ?? [];
    if (worst.length) {
      const keys = [...new Set(worst.flatMap((r) => Object.keys(r)))];
      out.push("", `Details on ${g.pages[0].page.url}:`, "", table(keys, worst.map((r) => keys.map((k) => r[k]))));
    }
    out.push("");
  }
}

function pagesSection(data: ExportData, out: string[]) {
  const header = ["URL", "HTTP"];
  if (has(data, "accessibility")) header.push("Accessibility", "Issues", "Critical");
  if (has(data, "seo")) header.push("SEO");
  if (has(data, "performance")) header.push("Performance");
  out.push("## All pages", "");
  out.push(
    table(
      header,
      data.pages.map((p) => {
        const row: unknown[] = [p.url, p.http_status ?? p.crawl_status];
        if (has(data, "accessibility")) row.push(p.a11y_score, p.violation_count, p.critical_count);
        if (has(data, "seo")) row.push(p.seo_score);
        if (has(data, "performance")) row.push(p.perf_score == null ? null : `${p.perf_score}${p.perf_estimated ? "*" : ""}`);
        return row;
      }),
    ),
    "",
  );
  if (has(data, "performance")) out.push("\\* Performance estimated from page timings (Lighthouse didn't run on this page).", "");
}

/** Report for AI coding agents: front matter with the key numbers, then findings grouped by fix, with exact selectors and instructions. */
export function markdown(data: ExportData) {
  const out: string[] = [frontMatter(data), "", `# ${reportTitle(data)}`, "", "## How to use this report", "", howToUse(data), ""];
  out.push("## Summary", "", table(["Metric", "Value"], summaryRows(data)), "");
  if (has(data, "accessibility")) accessibilitySection(data, out);
  if (has(data, "seo")) seoSection(data, out);
  lighthouseSection(data, out);
  pagesSection(data, out);
  return out.join("\n");
}
