"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dismissViolation, restoreViolation } from "@/app/actions";
import { Button } from "./ui";

export function FalsePositiveButton({ violationId, ruleHelp, ruleId }: { violationId: string; ruleHelp: string; ruleId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [scope, setScope] = useState<"page" | "site">("page");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const id = useId();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await dismissViolation({ violationId, scope, reason });
      if (!res.ok) return setError(res.error);
      dialogRef.current?.close();
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => dialogRef.current?.showModal()}>
        False positive<span className="sr-only">: {ruleHelp}</span>
      </Button>
      <dialog ref={dialogRef} aria-labelledby={`${id}-title`} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-5 shadow-xl sm:p-6">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <h2 id={`${id}-title`} className="text-lg font-semibold text-slate-900">
              Mark as false positive
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {ruleHelp} <span className="text-xs text-slate-500">({ruleId})</span>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              The issue is hidden and no longer counts toward scores or the dashboard. It stays hidden in future re-scans, and you can restore it at any
              time.
            </p>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-800">Apply to</legend>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="radio" name="scope" value="page" checked={scope === "page"} onChange={() => setScope("page")} className="mt-1" />
              <span>Only this page</span>
            </label>
            <label className="mt-1 flex items-start gap-2 text-sm">
              <input type="radio" name="scope" value="site" checked={scope === "site"} onChange={() => setScope("site")} className="mt-1" />
              <span>
                Every page on this site
                <span className="block text-xs text-slate-600">Useful when the issue comes from a shared header, footer or widget.</span>
              </span>
            </label>
          </fieldset>

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
              placeholder="e.g. Contrast is fine; axe can't read the gradient background"
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
              {pending ? "Saving..." : "Mark as false positive"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function RestoreButton({ dismissalId, ruleHelp }: { dismissalId: string; ruleHelp: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
      <Button
        variant="secondary"
        className="px-3 py-1.5 text-xs"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await restoreViolation(dismissalId);
            if (!res.ok) return setError(res.error);
            router.refresh();
          })
        }
      >
        {pending ? "Restoring..." : "Restore"}
        <span className="sr-only">: {ruleHelp}</span>
      </Button>
    </div>
  );
}
