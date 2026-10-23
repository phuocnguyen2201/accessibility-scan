"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { SCAN_CHECK_LABELS, SCAN_CHECKS, type Scan } from "@a11y/shared";
import { cancelScan, startScan } from "@/app/actions";
import { useRouter } from "next/navigation";
import { canExportStatus } from "@/lib/export-formats";
import { browserClient } from "@/lib/supabase";
import { formatDate, formatDuration } from "@/lib/format";
import { ExportMenu } from "../ExportMenu";
import { Button, CountBadge, ProgressBar, StatusBadge } from "../ui";
import { Overview } from "./Overview";
import { PagesTable } from "./PagesTable";

type ScanWithSite = Scan & { site: { display_url: string; normalized_url: string } };

/** Per-browser re-scan email choice: "always" sends without asking, "never" skips without asking. */
const RESCAN_EMAIL_KEY = "rescan-email";

const PHASE_LABEL: Record<string, string> = {
  crawling: "Crawling and checking pages",
  lighthouse: "Running Lighthouse on sampled pages",
  finalizing: "Computing summary",
};

/** canExport: the viewer is a registered user (guests can't download or get reports by email). */
export function ScanView({ initialScan, tab, canExport }: { initialScan: ScanWithSite; tab: "overview" | "pages"; canExport: boolean }) {
  const [scan, setScan] = useState(initialScan);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const live = scan.status === "queued" || scan.status === "running";
  const countOnly = scan.mode === "count";
  // A page count ran no checks, so every score and issue view hides itself.
  const checks = countOnly ? [] : scan.checks?.length ? scan.checks : [...SCAN_CHECKS];

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

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [remember, setRemember] = useState<"always" | "never" | null>(null);

  const runRescan = (notify: boolean) =>
    startTransition(async () => {
      const res = await startScan({
        url: scan.site.display_url,
        maxPages: scan.max_pages,
        lighthouseSample: scan.lighthouse_sample,
        checks: countOnly ? ["accessibility"] : checks,
        notify,
        mode: countOnly ? "count" : "full",
      });
      if (res.ok) router.push(`/scans/${res.scanId}`);
    });

  const rescan = () => {
    // Guests have no email address, and page counts send no report, so there's nothing to ask.
    if (!canExport || countOnly) return runRescan(false);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(RESCAN_EMAIL_KEY);
    } catch {}
    if (saved === "always" || saved === "never") return runRescan(saved === "always");
    setRemember(null);
    dialogRef.current?.showModal();
  };

  const answer = (notify: boolean) => {
    if (remember) {
      try {
        localStorage.setItem(RESCAN_EMAIL_KEY, remember);
      } catch {}
    }
    dialogRef.current?.close();
    runRescan(notify);
  };

  const tabClass = (active: boolean) =>
    `border-b-2 px-4 py-2 text-sm font-medium ${active ? "border-blue-700 text-blue-800" : "border-transparent text-slate-600 hover:text-slate-900"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-full">
          <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl" title={scan.site.normalized_url}>{scan.site.normalized_url}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <StatusBadge status={scan.status} />
            {countOnly && <CountBadge />}
            <span>Started {formatDate(scan.started_at ?? scan.created_at)}</span>
            <span>· Duration {formatDuration(scan.started_at, scan.finished_at)}</span>
            <span>· Max {scan.max_pages} pages</span>
            {!countOnly && <span>· {checks.map((c) => SCAN_CHECK_LABELS[c]).join(", ")}</span>}
          </p>
          {scan.error && <p className="mt-2 text-sm text-red-700">Error: {scan.error}</p>}
          {canExport && <EmailStatus scan={scan} />}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {canExport && !countOnly && canExportStatus(scan.status) && <ExportMenu scanId={scan.id} />}
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

      <dialog ref={dialogRef} aria-labelledby="rescan-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-5 shadow-xl sm:p-6">
        <h2 id="rescan-title" className="text-lg font-semibold text-slate-900">
          Re-scan this site
        </h2>
        <p className="mt-2 text-sm text-slate-700">Send a notification by email with the reports when the re-scan finishes?</p>
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={remember === "always"}
              onChange={(e) => setRemember(e.target.checked ? "always" : null)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Always send email notification on re-scan
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={remember === "never"}
              onChange={(e) => setRemember(e.target.checked ? "never" : null)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Never ask again (don&apos;t send email)
          </label>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={pending || remember === "always"} onClick={() => answer(false)}>
            No
          </Button>
          <Button disabled={pending || remember === "never"} onClick={() => answer(true)}>
            Yes
          </Button>
        </div>
      </dialog>

      {countOnly && !live && scan.pages_found >= scan.max_pages && (
        <p className="text-sm text-amber-800">
          Reached the {scan.max_pages}-page cap: the site has at least this many pages.
        </p>
      )}

      {!canExport && !live && (
        <p className="text-sm text-slate-700">
          <Link href="/signup" className="font-medium text-blue-700 underline">
            Create a free account
          </Link>{" "}
          to download reports (PDF, Excel, Markdown for AI agents) and get them by email when a scan finishes.
        </p>
      )}

      {live && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4" aria-live="polite">
          {scan.status === "queued" ? (
            <p className="text-sm text-blue-900">Waiting for a worker to pick up this scan... (is the worker running?)</p>
          ) : (
            <ProgressBar
              value={scan.pages_scanned}
              max={Math.max(scan.pages_found, 1)}
              label={countOnly && scan.phase !== "finalizing" ? "Counting pages" : (PHASE_LABEL[scan.phase ?? "crawling"] ?? "Scanning")}
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

      {tab === "overview" ? <Overview scan={scan} checks={checks} /> : <PagesTable scanId={scan.id} live={live} checks={checks} />}
    </div>
  );
}

function EmailStatus({ scan }: { scan: Scan }) {
  if (!scan.notify_email) return null;
  if (scan.notify_error) return <p className="mt-2 text-sm text-red-700">The report email couldn&apos;t be sent: {scan.notify_error}</p>;
  if (scan.notified_at) return <p className="mt-2 text-sm text-slate-600">The reports were emailed to you on {formatDate(scan.notified_at)}.</p>;
  if (scan.status === "queued" || scan.status === "running") return <p className="mt-2 text-sm text-slate-600">You&apos;ll get the reports by email when this scan finishes.</p>;
  return null;
}
