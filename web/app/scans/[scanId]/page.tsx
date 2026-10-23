import { notFound } from "next/navigation";
import type { PageExclusion, Scan } from "@a11y/shared";
import { ScanView } from "@/components/scan/ScanView";
import { isGuest } from "@/lib/guest";
import { currentUser, serverClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ scanId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { scanId } = await params;
  const { tab } = await searchParams;
  const [user, { data: scan }] = await Promise.all([
    currentUser(),
    (await serverClient())
      .from("scans")
      .select("*, site:sites!scans_site_id_fkey(display_url, normalized_url)")
      .eq("id", scanId)
      .maybeSingle(),
  ]);
  if (!scan) notFound();

  const db = await serverClient();
  const [{ data: exclusions }, { data: excludedHere }] = await Promise.all([
    db.from("page_exclusions").select("*").eq("site_id", scan.site_id).order("created_at", { ascending: false }),
    db.from("pages").select("normalized_url").eq("scan_id", scanId).eq("excluded", true),
  ]);
  const inScan = new Set((excludedHere ?? []).map((p) => p.normalized_url as string));

  return (
    <ScanView
      initialScan={scan as Scan & { site: { display_url: string; normalized_url: string } }}
      tab={tab === "pages" || tab === "excluded" ? tab : "overview"}
      canExport={!isGuest(user)}
      exclusions={((exclusions as PageExclusion[] | null) ?? []).map((e) => ({ ...e, inScan: inScan.has(e.page_key) }))}
    />
  );
}
