"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { Scan } from "@a11y/shared";
import { cancelScan, startScan } from "@/app/actions";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase";
import { formatDate, formatDuration } from "@/lib/format";
import { Button, ProgressBar, StatusBadge } from "../ui";
import { Overview } from "./Overview";
import { PagesTable } from "./PagesTable";

type ScanWithSite = Scan & { site: { display_url: string; normalized_url: string } };

const PHASE_LABEL: Record<string, string> = {
  crawling: "Crawling and checking accessibility",
  lighthouse: "Running Lighthouse on sampled pages",
  finalizing: "Computing summary",
};

export function ScanView({ initialScan, tab }: { initialScan: ScanWithSite; tab: "overview" | "pages" }) {
  const [scan, setScan] = useState(initialScan);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const live = scan.status === "queued" || scan.status === "running";

  useEffect(() => {
    const db = browserClient();
    const channel = db
      .channel(`scan-${scan.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "scans", filter: `id=eq.${scan.id}` }, (payload) =>
        setScan((prev) => ({ ...prev, ...(payload.new as Scan) })),
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [scan.id]);

  const rescan = () =>
    startTransition(async () => {
      const res = await startScan({ url: scan.site.display_url, maxPages: scan.max_pages, lighthouseSample: scan.lighthouse_sample });
      if (res.ok) router.push(`/scans/${res.scanId}`);
    });

  const tabClass = (active: boolean) =>
    `border-b-2 px-4 py-2 text-sm font-medium ${active ? "border-blue-700 text-blue-800" : "border-transparent text-slate-600 hover:text-slate-900"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-full">
          <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl" title={scan.site.normalized_url}>{scan.site.normalized_url}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <StatusBadge status={scan.status} />
            <span>Started {formatDate(scan.started_at ?? scan.created_at)}</span>
            <span>· Duration {formatDuration(scan.started_at, scan.finished_at)}</span>
            <span>· Max {scan.max_pages} pages</span>
          </p>
          {scan.error && <p className="mt-2 text-sm text-red-700">Error: {scan.error}</p>}
        </div>
        <div className="flex gap-2">
          {live ? (
            <Button variant="danger" disabled={pending} onClick={() => startTransition(() => cancelScan(scan.id))}>
              Cancel scan
            </Button>
          ) : (
            <Button variant="secondary" disabled={pending} onClick={rescan}>
              Re-scan
            </Button>
          )}
        </div>
      </div>

      {live && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4" aria-live="polite">
          {scan.status === "queued" ? (
            <p className="text-sm text-blue-900">Waiting for a worker to pick up this scan... (is the worker running?)</p>
          ) : (
            <ProgressBar
              value={scan.pages_scanned}
              max={Math.max(scan.pages_found, 1)}
              label={PHASE_LABEL[scan.phase ?? "crawling"] ?? "Scanning"}
            />
          )}
        </div>
      )}

      <nav aria-label="Scan sections" className="flex border-b border-slate-200">
        <Link href={`/scans/${scan.id}`} className={tabClass(tab === "overview")} aria-current={tab === "overview" ? "page" : undefined}>
          Overview
        </Link>
        <Link href={`/scans/${scan.id}?tab=pages`} className={tabClass(tab === "pages")} aria-current={tab === "pages" ? "page" : undefined}>
          Pages ({scan.pages_found})
        </Link>
      </nav>

      {tab === "overview" ? <Overview scan={scan} /> : <PagesTable scanId={scan.id} live={live} />}
    </div>
  );
}
