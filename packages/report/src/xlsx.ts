import ExcelJS from "exceljs";
import type { ExportData } from "./load";
import { has, issueRows, lighthouseAuditRows, pageRows, reportTitle, seoRows, summaryRows, type Row } from "./rows";

/** Excel treats cells starting with these as formulas; page titles and URLs come from untrusted sites. */
const defuse = (v: unknown) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v);

function addTableSheet(wb: ExcelJS.Workbook, name: string, rows: Row[], widths: Record<string, number> = {}) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  const header = rows.length ? Object.keys(rows[0]) : [];
  ws.columns = header.map((h) => ({ header: h, key: h, width: widths[h] ?? Math.max(10, h.length + 2) }));
  ws.addRows(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, defuse(v)]))));
  ws.getRow(1).font = { bold: true };
  if (header.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };
  return ws;
}

const URL_WIDTH = 60;
const TEXT_WIDTH = 60;

/** Workbook with Summary, Pages and one sheet per kind of finding (only for the checks the scan ran). */
export async function workbook(data: ExportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "A11y Site Scanner";
  wb.created = new Date();

  const summary = wb.addWorksheet("Summary");
  summary.columns = [{ width: 36 }, { width: 48 }];
  summary.addRow([reportTitle(data)]).font = { bold: true, size: 14 };
  summary.addRow([]);
  for (const [k, v] of summaryRows(data)) summary.addRow([k, defuse(v)]).getCell(1).font = { bold: true };

  const top = has(data, "accessibility") ? (data.summary?.top_issues ?? []) : [];
  if (top.length) {
    summary.addRow([]);
    summary.addRow(["Most common accessibility issues"]).font = { bold: true, size: 12 };
    summary.addRow(["Issue", "Rule", "Impact", "Pages", "Elements"]).font = { bold: true };
    for (const t of top) summary.addRow([t.help, t.rule_id, t.impact, t.pages, t.nodes]);
  }

  addTableSheet(wb, "Pages", pageRows(data), { URL: URL_WIDTH, Title: 40, "Failed SEO checks": 40, Error: 40 });
  if (has(data, "accessibility")) {
    addTableSheet(wb, "Accessibility issues", issueRows(data), {
      "Page URL": URL_WIDTH,
      Issue: 50,
      Description: TEXT_WIDTH,
      "Example element": 40,
      "How to fix (axe-core)": TEXT_WIDTH,
      WCAG: 30,
      Reference: 50,
    });
  }
  if (has(data, "seo")) {
    addTableSheet(wb, "SEO issues", seoRows(data), { "Page URL": URL_WIDTH, Check: 36, Found: 30, "How to fix": TEXT_WIDTH, Reference: 50 });
  }
  const audits = lighthouseAuditRows(data);
  if (audits.length) {
    addTableSheet(wb, "Lighthouse audits", audits, { "Page URL": URL_WIDTH, Audit: 40, Result: 20, "How to fix (Lighthouse)": TEXT_WIDTH, Reference: 50 });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
