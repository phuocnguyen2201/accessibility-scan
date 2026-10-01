import { notFound } from "next/navigation";
import type { Scan } from "@a11y/shared";
import { ScanView } from "@/components/scan/ScanView";
import { serverClient } from "@/lib/supabase-server";

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
  const { data: scan } = await (await serverClient())
    .from("scans")
    .select("*, site:sites!scans_site_id_fkey(display_url, normalized_url)")
    .eq("id", scanId)
    .maybeSingle();
  if (!scan) notFound();

  return <ScanView initialScan={scan as Scan & { site: { display_url: string; normalized_url: string } }} tab={tab === "pages" ? "pages" : "overview"} />;
}
