"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { excludePages } from "@/app/actions";
import { Button } from "./ui";

/** Marks one or more pages as "not the same site", with an optional reason. */
export function ExcludePagesButton({
  scanId,
  pageIds,
  label,
  onDone,
  className = "px-3 py-1.5 text-xs",
}: {
  scanId: string;
  pageIds: string[];
  label: string;
  onDone?: () => void;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const id = useId();
  const many = pageIds.length > 1;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await excludePages({ scanId, pageIds, reason });
      if (!res.ok) return setError(res.error);
      dialogRef.current?.close();
      setReason("");
      onDone?.();
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="secondary" className={className} disabled={!pageIds.length} onClick={() => dialogRef.current?.showModal()}>
        {label}
      </Button>
      <dialog ref={dialogRef} aria-labelledby={`${id}-title`} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-5 shadow-xl sm:p-6">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <h2 id={`${id}-title`} className="text-lg font-semibold text-slate-900">
              {many ? `Mark ${pageIds.length} pages as not the same site` : "Mark page as not the same site"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {many ? "These pages are" : "This page is"} hidden from results, scores and exports, and skipped on future re-scans. You can find{" "}
              {many ? "them" : "it"} under &quot;Not the same site&quot; and add {many ? "them" : "it"} back at any time.
            </p>
          </div>

          <div>
            <label htmlFor={`${id}-reason`} className="block text-sm font-medium text-slate-800">
              Reason <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              id={`${id}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Another project hosted on the same domain"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Mark as not the same site"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
