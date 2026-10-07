import ExcelJS from "exceljs";
import type { QueueHealth, UsageMonth, UsageStats } from "@a11y/shared";
import { toCsv } from "./csv";
import type { Row } from "./rows";

// Usage statistics for the owner's admin dashboard. Everything here is aggregate: the RPC that produces
// UsageStats never returns user or site data, and nothing below adds any.

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
const day = (iso: string) => iso.slice(0, 10);

/** Month-over-month change in % between the last two months of the series (null without a baseline). */
export function growth(monthly: UsageMonth[], key: keyof Omit<UsageMonth, "month"> = "mau") {
  if (monthly.length < 2) return null;
  const [prev, last] = monthly.slice(-2);
  return prev[key] > 0 ? Math.round(((last[key] - prev[key]) / prev[key]) * 1000) / 10 : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09" → "Sep/26" — a slash so the month/year pair doesn't read as a month/day date. */
export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]}/${month.slice(2, 4)}`;

/** "1 Sep 2026 – 30 Sep 2026" (the range end is exclusive). */
export function rangeLabel(stats: UsageStats) {
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${fmt(new Date(stats.range.from))} – ${fmt(new Date(new Date(stats.range.to).getTime() - 1))}`;
}

export function usageSummaryRows(s: UsageStats): [string, string | number | null][] {
  const { kpis: k, engagement: e, scan_time: t, limits: l, features: f, reliability: r, findings: fd } = s;
  const finished = r.completed + r.failed;
  return [
    ["Period", `${day(s.range.from)} to ${day(s.range.to)} (exclusive)`],
    ["Registered users (all time)", k.registered_users],
    ["Guest users (all time)", k.guest_users],
    ["New sign-ups", k.new_signups],
    ["Active users", k.active_users],
    ["MAU growth, last month (%)", growth(s.monthly)],
    ["Returning users (2+ scans)", e.returning_users],
    ["Stickiness (DAU/MAU, last 30 days)", e.stickiness],
    ["Guests converted to accounts (all time)", e.converted_guests],
    ["Guest conversion rate (%)", pct(e.converted_guests, e.total_guests_ever)],
    ["Scans", k.scans],
    ["Pages scanned", k.pages_scanned],
    ["Scanning time (hours)", k.scan_hours],
    ["Average scan (minutes)", t.avg_minutes],
    ["Median scan (minutes)", t.median_minutes],
    ["Average pages per scan", t.avg_pages],
    ["Throughput (pages per hour)", t.pages_per_hour],
    ["Lighthouse runs", k.lighthouse_runs],
    [`Times the daily limit (${l.daily_limit}) was reached`, l.limit_reached],
    ["Guest share of scans (%)", pct(l.guest_scans, l.guest_scans + l.registered_scans)],
    ["Accessibility checked (% of scans)", pct(f.accessibility, f.scans)],
    ["SEO checked (% of scans)", pct(f.seo, f.scans)],
    ["Performance checked (% of scans)", pct(f.performance, f.scans)],
    ["Best practices checked (% of scans)", pct(f.best_practices, f.scans)],
    ["Email report opt-in (% of scans)", pct(f.email_opt_in, f.scans)],
    ["Emails sent / failed", `${f.emails_sent} / ${f.emails_failed}`],
    ["Completed / failed / cancelled scans", `${r.completed} / ${r.failed} / ${r.cancelled}`],
    ["Failure rate (%)", pct(r.failed, finished)],
    ["Pages checked for accessibility", fd.pages_checked],
    ["Accessibility issues found (elements)", fd.issues_found],
    ["Average accessibility / SEO / performance score", `${fd.avg_a11y ?? "-"} / ${fd.avg_seo ?? "-"} / ${fd.avg_perf ?? "-"}`],
  ];
}

export const monthlyRows = (s: UsageStats): Row[] =>
  s.monthly.map((m, i) => {
    const prev = s.monthly[i - 1];
    return {
      Month: m.month,
      MAU: m.mau,
      "MAU growth %": prev && prev.mau > 0 ? Math.round(((m.mau - prev.mau) / prev.mau) * 1000) / 10 : null,
      "Registered MAU": m.registered_mau,
      "New users": m.new_users,
      "Returning users": m.mau - m.new_users,
      "Sign-ups": m.signups,
      Scans: m.scans,
      Pages: m.pages,
      "Scan hours": Math.round((m.scan_minutes / 60) * 10) / 10,
      "Lighthouse runs": m.lighthouse_runs,
    };
  });

export const dailyRows = (s: UsageStats): Row[] =>
  s.daily.map((d) => ({
    Day: d.day,
    "Active users": d.active_users,
    Completed: d.completed,
    Failed: d.failed,
    Cancelled: d.cancelled,
    "In progress": d.in_progress,
  }));

export const errorRows = (s: UsageStats): Row[] => s.reliability.errors.map((e) => ({ Category: e.category, Scans: e.count }));

export const topRuleRows = (s: UsageStats): Row[] =>
  s.findings.top_rules.map((r) => ({
    Issue: r.help,
    Rule: r.rule_id,
    Pages: r.pages,
    "% of checked pages": pct(r.pages, s.findings.pages_checked),
  }));

export const USAGE_CSV_TABLES = ["summary", "monthly", "daily"] as const;
export type UsageCsvTable = (typeof USAGE_CSV_TABLES)[number];

export function usageCsv(s: UsageStats, table: UsageCsvTable = "monthly") {
  if (table === "summary") return toCsv(usageSummaryRows(s).map(([Metric, Value]) => ({ Metric, Value })));
  return toCsv(table === "daily" ? dailyRows(s) : monthlyRows(s));
}

function addSheet(wb: ExcelJS.Workbook, name: string, rows: Row[], firstWidth = 14) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  const header = rows.length ? Object.keys(rows[0]) : [];
  ws.columns = header.map((h, i) => ({ header: h, key: h, width: i === 0 ? firstWidth : Math.max(10, h.length + 2) }));
  ws.addRows(rows);
  ws.getRow(1).font = { bold: true };
}

/** Workbook: Summary, Monthly, Daily, Failures, Top issues (and Queue when given). */
export async function usageWorkbook(s: UsageStats, health?: QueueHealth | null): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "A11y Site Scanner";
  wb.created = new Date();

  const summary = wb.addWorksheet("Summary");
  summary.columns = [{ width: 46 }, { width: 30 }];
  summary.addRow(["Usage statistics"]).font = { bold: true, size: 14 };
  summary.addRow([rangeLabel(s)]);
  summary.addRow([]);
  for (const [k, v] of usageSummaryRows(s)) summary.addRow([k, v ?? "-"]).getCell(1).font = { bold: true };

  addSheet(wb, "Monthly", monthlyRows(s));
  addSheet(wb, "Daily", dailyRows(s));
  addSheet(wb, "Failures", errorRows(s), 28);
  addSheet(wb, "Top issues", topRuleRows(s), 50);
  if (health) {
    const q = wb.addWorksheet("Queue");
    q.columns = [{ width: 30 }, { width: 24 }];
    q.addRow([`Queue at ${new Date().toISOString()}`]).font = { bold: true };
    q.addRows([
      ["Queued scans", health.queued_scans],
      ["Running scans", health.running_scans],
      ["Oldest queued (minutes)", health.oldest_queued_minutes ?? "-"],
      ["Lighthouse queued / running", `${health.lighthouse_queued} / ${health.lighthouse_running}`],
    ]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
