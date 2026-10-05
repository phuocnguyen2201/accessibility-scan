import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { UsageStats } from "@a11y/shared";
import { snapshotHtml } from "./snapshot";
import { growth, monthlyRows, usageCsv, usageWorkbook } from "./usage";

function stats(extra: Partial<UsageStats> = {}): UsageStats {
  return {
    range: { from: "2026-08-01T00:00:00Z", to: "2026-10-01T00:00:00Z" },
    kpis: { registered_users: 10, guest_users: 5, new_signups: 4, active_users: 9, scans: 40, pages_scanned: 2000, scan_hours: 12.5, lighthouse_runs: 30 },
    monthly: [
      { month: "2026-08", mau: 4, registered_mau: 3, new_users: 4, signups: 2, scans: 15, pages: 800, scan_minutes: 300, lighthouse_runs: 10 },
      { month: "2026-09", mau: 6, registered_mau: 5, new_users: 3, signups: 2, scans: 25, pages: 1200, scan_minutes: 450, lighthouse_runs: 20 },
    ],
    daily: [{ day: "2026-09-30", completed: 2, failed: 1, cancelled: 0, in_progress: 0, active_users: 2 }],
    engagement: { stickiness: 0.2, returning_users: 3, converted_guests: 1, total_guests_ever: 5 },
    scan_time: { avg_minutes: 18.8, median_minutes: 12, pages_per_hour: 160, avg_pages: 50 },
    limits: { daily_limit: 15, limit_reached: 1, guest_scans: 8, registered_scans: 32 },
    features: { scans: 40, accessibility: 40, seo: 20, performance: 10, best_practices: 5, email_opt_in: 6, emails_sent: 5, emails_failed: 1 },
    reliability: { completed: 36, failed: 3, cancelled: 1, errors: [{ category: "Timeout", count: 3 }] },
    findings: {
      pages_checked: 1900,
      avg_a11y: 82,
      avg_seo: 90,
      avg_perf: 61,
      issues_found: 12000,
      top_rules: [{ rule_id: "color-contrast", help: "Elements must meet <minimum> color contrast", pages: 950 }],
    },
    ...extra,
  };
}

describe("usage statistics", () => {
  it("computes month-over-month growth from the last two months", () => {
    expect(growth(stats().monthly)).toBe(50);
    expect(growth(stats().monthly.slice(1))).toBeNull();
    expect(monthlyRows(stats())[1]).toMatchObject({ MAU: 6, "MAU growth %": 50, "Returning users": 3, "Scan hours": 7.5 });
  });

  it("exports CSV tables and a workbook with one sheet per section", async () => {
    expect(usageCsv(stats(), "monthly").split("\r\n")[1]).toMatch(/^2026-08,4,/);
    expect(usageCsv(stats(), "summary")).toContain("Scanning time (hours),12.5");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await usageWorkbook(stats())) as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Summary", "Monthly", "Daily", "Failures", "Top issues"]);
  });

  it("builds a self-contained, escaped two-slide snapshot", () => {
    const html = snapshotHtml(stats(), { appName: "Scanner <b>", appUrl: "example.app", accent: "red;}body{x" });
    expect(html.match(/class="slide /g)).toHaveLength(2);
    expect(html).toContain("+50% MoM");
    expect(html).toContain("50%"); // 950 / 1900 pages
    expect(html).toContain("Scanner &lt;b&gt;");
    expect(html).toContain("&lt;minimum&gt;");
    expect(html).not.toContain("red;}"); // invalid accent falls back to the default
    expect(html).not.toMatch(/<script|https?:\/\/(?!www\.w3\.org)/);
  });

  it("still renders with a single month and no findings", () => {
    const one = stats({ monthly: stats().monthly.slice(1), findings: { ...stats().findings, pages_checked: 0, top_rules: [] } });
    const html = snapshotHtml(one, { appName: "Scanner" });
    expect(html).toContain("Daily active users");
    expect(html).not.toContain("What we found most");
    expect(html).not.toContain("NaN");
  });
});
