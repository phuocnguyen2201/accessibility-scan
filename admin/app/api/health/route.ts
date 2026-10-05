import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { loadHealth, systemInfo } from "@/lib/stats";

export const dynamic = "force-dynamic";

/** Live queue + Pi readings, polled by the dashboard's health card. */
export async function GET() {
  await requireAdmin();
  const [queue, system] = await Promise.all([loadHealth(), systemInfo()]);
  return NextResponse.json({ queue, system, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
