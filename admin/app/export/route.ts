import { NextResponse, type NextRequest } from "next/server";
import {
  CSS_PAGES,
  SNAPSHOT_HEIGHT,
  SNAPSHOT_WIDTH,
  USAGE_CSV_TABLES,
  renderPdf,
  renderPng,
  snapshotHtml,
  usageCsv,
  usageWorkbook,
  type UsageCsvTable,
} from "@a11y/report";
import { requireAdmin } from "@/lib/auth";
import { withBrowser } from "@/lib/browser";
import { isoDay, parseRange } from "@/lib/range";
import { loadHealth, loadStats, snapshotOptions } from "@/lib/stats";

export const dynamic = "force-dynamic";

const TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  html: "text/html; charset=utf-8",
  pdf: "application/pdf",
  png: "image/png",
} as const;
type Format = keyof typeof TYPES;

/** GET /export?format=xlsx|csv|html|pdf|png[&table=summary|monthly|daily][&preset=..|&from=..&to=..] */
export async function GET(request: NextRequest) {
  await requireAdmin();
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const format = (params.format ?? "xlsx") as Format;
  if (!(format in TYPES)) return new NextResponse("Unknown format", { status: 400 });

  const range = parseRange(params);
  const stats = await loadStats(range);
  const period = `${isoDay(range.from)}_${isoDay(new Date(range.to.getTime() - 1))}`;

  let body: Buffer | string;
  let name: string;
  if (format === "xlsx") {
    body = await usageWorkbook(stats, await loadHealth().catch(() => null));
    name = `usage-${period}.xlsx`;
  } else if (format === "csv") {
    const table = (USAGE_CSV_TABLES as readonly string[]).includes(params.table) ? (params.table as UsageCsvTable) : "monthly";
    body = usageCsv(stats, table);
    name = `usage-${table}-${period}.csv`;
  } else {
    const html = snapshotHtml(stats, snapshotOptions());
    name = `snapshot-${period}.${format}`;
    if (format === "html") body = html;
    else body = await withBrowser((b) => (format === "pdf" ? renderPdf(b, html, CSS_PAGES) : renderPng(b, html, { width: SNAPSHOT_WIDTH, height: SNAPSHOT_HEIGHT })));
  }

  return new NextResponse(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": TYPES[format],
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
