import { NextResponse, type NextRequest } from "next/server";
import { canExportStatus } from "@/lib/export-formats";
import { exportBaseName, issuesCsv, loadExportData, markdown, pagesCsv, workbook } from "@/lib/export";
import { isGuest } from "@/lib/guest";
import { currentUser } from "@/lib/supabase-server";

const FORMATS = {
  xlsx: { ext: "xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  csv: { ext: "csv", type: "text/csv; charset=utf-8" },
  md: { ext: "md", type: "text/markdown; charset=utf-8" },
} as const;

/**
 * Downloads one scan's results (registered users only).
 * ?format=xlsx (Summary, Pages and one sheet per kind of finding) | csv (pages; add &table=issues for issues) | md (report for AI agents).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "xlsx";
  if (!(format in FORMATS)) return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  const { ext, type } = FORMATS[format as keyof typeof FORMATS];
  const issuesTable = format === "csv" && request.nextUrl.searchParams.get("table") === "issues";

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (isGuest(user)) return NextResponse.json({ error: "Create an account to download reports" }, { status: 403 });
  const data = await loadExportData(scanId);
  if (!data) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  if (!canExportStatus(data.scan.status)) return NextResponse.json({ error: "Reports are available when the scan finishes" }, { status: 409 });

  const body = format === "xlsx" ? new Uint8Array(await workbook(data)) : format === "md" ? markdown(data) : issuesTable ? issuesCsv(data) : pagesCsv(data);
  const filename = `${exportBaseName(data)}${issuesTable ? "_issues" : format === "csv" ? "_pages" : ""}.${ext}`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
