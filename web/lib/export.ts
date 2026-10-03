import "server-only";
import { loadExportData as load } from "@a11y/report";
import { serverClient } from "./supabase-server";

export { exportBaseName, issuesCsv, markdown, pagesCsv, workbook, type ExportData } from "@a11y/report";

/** Loads a scan for export as the signed-in user (RLS: only their own scans). */
export async function loadExportData(scanId: string) {
  return load(await serverClient(), scanId);
}
