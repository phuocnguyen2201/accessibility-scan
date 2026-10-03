import { describe, expect, it } from "vitest";
import type { ScanCheck } from "@a11y/shared";
import ExcelJS from "exceljs";
import { csvCell } from "./csv";
import { reportHtml } from "./html";
import type { ExportData, ExportPage } from "./load";
import { markdown } from "./markdown";
import { pageRows, ruleGroups } from "./rows";
import { workbook } from "./xlsx";

function page(id: string, url: string, extra: Partial<ExportPage> = {}): ExportPage {
  return {
    id,
    scan_id: "scan-1",
    url,
    normalized_url: url,
    depth: 0,
    crawl_status: "done",
    http_status: 200,
    title: "Home",
    a11y_score: 80,
    seo_score: 90,
    perf_score: 70,
    perf_estimated: true,
    violation_count: 3,
    critical_count: 1,
    perf_metrics: null,
    seo_checks: [{ id: "meta-description", label: "Meta description is 50-160 characters", passed: false, detail: "Missing meta description" }],
    lighthouse_status: "none",
    error: null,
    scanned_at: "2026-10-03T10:00:00Z",
    ...extra,
  };
}

function fixture(checks: ScanCheck[] = ["accessibility", "seo", "performance", "best-practices"]): ExportData {
  const pages = [page("p1", "https://example.com/"), page("p2", "https://example.com/about", { title: '<script>alert("x")</script>' })];
  return {
    scan: {
      id: "scan-1",
      site_id: "site-1",
      user_id: "user-1",
      start_url: "https://example.com/",
      status: "completed",
      phase: null,
      max_pages: 10,
      lighthouse_sample: 1,
      checks,
      pages_found: 2,
      pages_scanned: 2,
      created_at: "2026-10-03T09:00:00Z",
      started_at: "2026-10-03T09:00:00Z",
      finished_at: "2026-10-03T10:00:00Z",
      error: null,
      summary: null,
      site: { display_url: "https://example.com/", normalized_url: "example.com" },
    },
    summary: {
      total_pages: 2,
      scanned_pages: 2,
      error_pages: 0,
      avg_a11y: 80,
      avg_seo: 90,
      avg_perf: 70,
      total_violations: 3,
      impact_counts: { critical: 1, serious: 2, moderate: 0, minor: 0 },
      top_issues: [],
    },
    checks,
    pages,
    issues: [
      {
        page_id: "p1",
        rule_id: "color-contrast",
        impact: "serious",
        help: "Elements must meet minimum color contrast ratio thresholds",
        description: "Ensure the contrast between foreground and background colors meets WCAG 2 AA",
        help_url: "https://dequeuniversity.com/rules/axe/4.10/color-contrast",
        wcag_tags: ["wcag2aa", "wcag143"],
        node_count: 2,
        nodes: [{ target: "a.nav", html: '<a class="nav">```Docs```</a>', failureSummary: "Fix any of the following:\n  Element has insufficient color contrast of 2.8" }],
      },
      {
        page_id: "p1",
        rule_id: "image-alt",
        impact: "critical",
        help: "Images must have alternative text",
        description: "Ensure <img> elements have alternate text",
        help_url: null,
        wcag_tags: ["wcag2a"],
        node_count: 1,
        nodes: [{ target: "iframe#x >>> img", html: "<img src=a.png>" }],
      },
    ],
    lighthouse: new Map([
      [
        "p1",
        {
          page_id: "p1",
          performance: 65,
          accessibility: 90,
          seo: 92,
          best_practices: 100,
          lcp: 3200,
          fcp: 1200,
          cls: 0.1,
          tbt: 300,
          speed_index: 2000,
          audits: [
            {
              id: "unused-javascript",
              category: "performance",
              title: "Reduce unused JavaScript",
              description: "Reduce unused JavaScript. [Learn how](https://developer.chrome.com/docs/lighthouse/performance/unused-javascript/).",
              displayValue: "Est savings of 120 KiB",
              score: 0.4,
              savingsMs: 600,
              savingsBytes: 120000,
              items: [{ url: "https://example.com/app.js", wastedBytes: 120000 }],
            },
          ],
        },
      ],
    ]),
  };
}

describe("markdown for agents", () => {
  const md = markdown(fixture());

  it("starts with front matter holding the key numbers", () => {
    expect(md.startsWith("---\nsite: \"example.com\"")).toBe(true);
    expect(md).toContain("checks: [accessibility, seo, performance, best-practices]");
    expect(md).toContain("accessibility_elements: { critical: 1, serious: 2, moderate: 0, minor: 0 }");
  });

  it("groups accessibility issues by rule, most severe first, with axe's fix text", () => {
    expect(md.indexOf("`image-alt`")).toBeLessThan(md.indexOf("`color-contrast`"));
    expect(md).toContain("Element has insufficient color contrast of 2.8");
    expect(md).toContain("Selector `iframe#x >>> img`");
  });

  it("uses a fence longer than any backtick run in untrusted HTML", () => {
    expect(md).toContain('````html\n   <a class="nav">```Docs```</a>\n   ````');
  });

  it("includes SEO and Lighthouse fixes", () => {
    expect(md).toContain('Add <meta name="description"');
    expect(md).toContain("### Reduce unused JavaScript (performance, `unused-javascript`)");
    expect(md).toContain("Estimated savings: up to 600 ms, up to 120 KB");
  });

  it("leaves out checks the scan didn't run", () => {
    const a11yOnly = markdown(fixture(["accessibility"]));
    expect(a11yOnly).not.toContain("## SEO issues");
    expect(a11yOnly).not.toContain("| SEO |");
  });
});

describe("rows", () => {
  it("only has columns for the checks that ran", () => {
    const [row] = pageRows(fixture(["accessibility"]));
    expect(row).toHaveProperty("Accessibility score");
    expect(row).not.toHaveProperty("SEO score");
    expect(row).not.toHaveProperty("Performance score");
  });

  it("merges a rule across pages and keeps its worst impact", () => {
    const data = fixture();
    data.issues.push({ ...data.issues[0], page_id: "p2", impact: "critical" });
    const contrast = ruleGroups(data).find((g) => g.rule_id === "color-contrast")!;
    expect(contrast.impact).toBe("critical");
    expect(contrast.pages).toHaveLength(2);
    expect(contrast.elements).toBe(4);
  });
});

describe("CSV", () => {
  it("defuses spreadsheet formulas from untrusted page content", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell(-5)).toBe("-5");
  });
});

describe("HTML for the PDF", () => {
  it("escapes untrusted page content", () => {
    const html = reportHtml(fixture());
    expect(html).not.toContain("<a class=\"nav\">");
    expect(html).toContain("&lt;a class=&quot;nav&quot;&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("Excel", () => {
  it("has a sheet per kind of finding", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await workbook(fixture())) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Summary", "Pages", "Accessibility issues", "SEO issues", "Lighthouse audits"]);
  });
});
