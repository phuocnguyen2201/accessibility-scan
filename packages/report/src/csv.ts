import type { ExportData } from "./load";
import { issueRows, pageRows, type Row } from "./rows";

/** Quotes a CSV cell and defuses spreadsheet formulas (page titles and URLs come from untrusted sites). */
export function csvCell(value: unknown) {
  if (value == null) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[]) {
  if (!rows.length) return "";
  const header = Object.keys(rows[0]);
  const lines = [header, ...rows.map((r) => header.map((h) => r[h]))].map((cells) => cells.map(csvCell).join(","));
  // BOM so Excel opens UTF-8 correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export const pagesCsv = (data: ExportData) => toCsv(pageRows(data));
export const issuesCsv = (data: ExportData) => toCsv(issueRows(data));
