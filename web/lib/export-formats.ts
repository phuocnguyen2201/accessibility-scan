/** Download options for a scan's results, served by app/scans/[scanId]/export/route.ts (registered users only). */
export const EXPORT_OPTIONS = [
  { label: "Excel (.xlsx)", hint: "Summary, pages and every finding with fixes", query: "format=xlsx" },
  { label: "Markdown for AI agents (.md)", hint: "Findings grouped by fix, with selectors", query: "format=md" },
  { label: "CSV: pages", hint: "One row per page with scores", query: "format=csv" },
  { label: "CSV: issues", hint: "One row per accessibility issue per page", query: "format=csv&table=issues" },
] as const;

export const exportHref = (scanId: string, query: string) => `/scans/${scanId}/export?${query}`;

/** Finished scans can be exported; a cancelled scan exports what it got through. */
export const canExportStatus = (status: string) => status === "completed" || status === "cancelled";
