"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SCAN_CHECK_LABELS, SCAN_CHECKS, type ScanCheck } from "@a11y/shared";
import { checkSite, startScan, type CheckResult } from "@/app/actions";
import { formatDate } from "@/lib/format";
import { Button, Card, StatusBadge } from "./ui";

type Existing = Extract<CheckResult, { exists: true }>;

export function ScanForm({
  maxPagesCap,
  defaultMaxPages,
  defaultLighthouseSample,
  maxLighthouseSample,
}: {
  maxPagesCap: number;
  defaultMaxPages: number;
  defaultLighthouseSample: number;
  /** Extra cap on the Lighthouse sample (guests). */
  maxLighthouseSample?: number;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(Math.min(defaultMaxPages, maxPagesCap));
  const lighthouseCap = Math.min(maxPages, maxLighthouseSample ?? Infinity);
  const [lighthouseSample, setLighthouseSample] = useState(defaultLighthouseSample);
  const [checks, setChecks] = useState<ScanCheck[]>([...SCAN_CHECKS]);
  const toggleCheck = (c: ScanCheck, on: boolean) =>
    setChecks((prev) => SCAN_CHECKS.filter((x) => (x === c ? on : prev.includes(x))));
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<Existing | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const launch = () =>
    startTransition(async () => {
      const res = await startScan({ url, maxPages, lighthouseSample, checks });
      dialogRef.current?.close();
      if (!res.ok) return setError(res.error);
      router.push(`/scans/${res.scanId}`);
    });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await checkSite(url);
      if (!res.ok) return setError(res.error);
      if (res.exists) {
        setExisting(res);
        dialogRef.current?.showModal();
        return;
      }
      launch();
    });
  };

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="url" className="mb-1 block text-sm font-medium text-slate-800">
          Website URL
        </label>
        <div className="flex gap-2">
          <input
            id="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            required
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "url-error" : undefined}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-500"
          />
          <Button type="submit" disabled={pending || !url.trim() || checks.length === 0}>
            {pending ? "Checking..." : "Scan"}
          </Button>
        </div>
        {error && (
          <p id="url-error" role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <fieldset className="mt-4" aria-describedby="checks-hint">
          <legend className="text-sm font-medium text-slate-800">What to check</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {SCAN_CHECKS.map((c) => (
              <label key={c} className="inline-flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={checks.includes(c)}
                  onChange={(e) => toggleCheck(c, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {SCAN_CHECK_LABELS[c]}
              </label>
            ))}
          </div>
          <p id="checks-hint" className={`mt-1 text-xs ${checks.length ? "text-slate-600" : "text-red-700"}`}>
            {checks.length ? "Best practices only runs on the Lighthouse sample." : "Choose at least one check."}
          </p>
        </fieldset>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-slate-700">Advanced options</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="maxPages" className="block text-sm font-medium text-slate-800">
                Max pages
              </label>
              <input
                id="maxPages"
                type="number"
                min={1}
                max={maxPagesCap}
                value={maxPages}
                onChange={(e) => setMaxPages(Math.max(1, Math.min(maxPagesCap, Number(e.target.value) || 1)))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                aria-describedby="maxPages-hint"
              />
              <p id="maxPages-hint" className="mt-1 text-xs text-slate-600">
                Up to {maxPagesCap}.{maxPagesCap >= 800 && " Around 800 pages takes 10-15 minutes."}
              </p>
            </div>
            <div>
              <label htmlFor="lhSample" className="block text-sm font-medium text-slate-800">
                Lighthouse sample
              </label>
              <input
                id="lhSample"
                type="number"
                min={0}
                max={lighthouseCap}
                value={lighthouseSample}
                onChange={(e) => setLighthouseSample(Math.max(0, Math.min(lighthouseCap, Number(e.target.value) || 0)))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                aria-describedby="lhSample-hint"
              />
              <p id="lhSample-hint" className="mt-1 text-xs text-slate-600">
                Lighthouse is slow (~15 s/page), so it only runs on the top N pages. You can run it on any page later.
              </p>
            </div>
          </div>
        </details>
      </form>

      <dialog
        ref={dialogRef}
        aria-labelledby="dup-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-5 shadow-xl sm:p-6"
        onClose={() => setExisting(null)}
      >
        {existing && (
          <>
            <h2 id="dup-title" className="text-lg font-semibold text-slate-900">
              This site was already scanned
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-medium">{existing.site.display_url}</span>
              {existing.lastScan && (
                <>
                  {" "}was last scanned on {formatDate(existing.lastScan.created_at)}{" "}
                  <StatusBadge status={existing.lastScan.status} />
                </>
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => dialogRef.current?.close()}>
                Cancel
              </Button>
              {existing.lastScan && (
                <Button variant="secondary" onClick={() => router.push(`/scans/${existing.lastScan!.id}`)}>
                  View results
                </Button>
              )}
              <Button onClick={launch} disabled={pending}>
                {existing.lastScan && ["queued", "running"].includes(existing.lastScan.status) ? "Open running scan" : "Re-scan"}
              </Button>
            </div>
          </>
        )}
      </dialog>
    </Card>
  );
}
