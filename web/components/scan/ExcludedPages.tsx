"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PageExclusion } from "@a11y/shared";
import { includePages } from "@/app/actions";
import { formatDate } from "@/lib/format";
import { Button, Card } from "../ui";

export type ExclusionRow = PageExclusion & { inScan: boolean };

/** Pages marked "not the same site": kept out of results and re-scans until added back. */
export function ExcludedPages({ exclusions }: { exclusions: ExclusionRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const include = (ids: string[]) => {
    setError(null);
    startTransition(async () => {
      const res = await includePages(ids);
      if (!res.ok) return setError(res.error);
      setSelected(new Set());
      router.refresh();
    });
  };
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <Card>
      <p className="text-sm text-slate-600">
        Pages you marked as not part of this site. They don&apos;t count toward results, scores or exports, and are skipped on the next scan. Add a
        page back to count it in these results again and scan it next time.
      </p>

      {exclusions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          No pages excluded. Select pages in the Pages tab and choose &quot;Mark as not the same site&quot;.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.size === exclusions.length}
                onChange={() => setSelected(selected.size === exclusions.length ? new Set() : new Set(exclusions.map((e) => e.id)))}
                className="size-4"
              />
              Select all
            </label>
            <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={!selected.size || pending} onClick={() => include([...selected])}>
              {pending ? "Adding back..." : `Add ${selected.size || ""} back to results`}
            </Button>
            {error && (
              <span role="alert" className="text-red-700">
                {error}
              </span>
            )}
          </div>

          <ul className="mt-3 divide-y divide-slate-100">
            {exclusions.map((e) => (
              <li key={e.id} className="flex gap-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                  aria-label={`Select ${e.url}`}
                  className="mt-1 size-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <a href={e.url} target="_blank" rel="noreferrer" className="block truncate font-medium text-blue-700 hover:underline" title={e.url}>
                    {e.url}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <p className="mt-1 text-xs text-slate-600">
                    Excluded {formatDate(e.created_at)}
                    {e.inScan ? " · Scanned in this scan, hidden from results" : " · Not in this scan"}
                    {e.reason && <span className="block text-slate-700">Reason: {e.reason}</span>}
                  </p>
                </div>
                <Button variant="secondary" className="shrink-0 self-start px-3 py-1.5 text-xs" disabled={pending} onClick={() => include([e.id])}>
                  Add back<span className="sr-only">: {e.url}</span>
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
