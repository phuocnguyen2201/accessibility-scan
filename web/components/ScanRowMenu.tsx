"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import type { ScanStatus } from "@a11y/shared";
import { deleteScan } from "@/app/actions";
import { formatDate } from "@/lib/format";
import { Button } from "./ui";

/** "⋯" actions menu for a scan in the history list. */
export function ScanRowMenu({
  scanId,
  siteLabel,
  createdAt,
  status,
  onDeleted,
}: {
  scanId: string;
  siteLabel: string;
  createdAt: string;
  status: ScanStatus;
  onDeleted: (scanId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const running = status === "running";

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  // Close on outside click; focus the first item when opened.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      close(e.key === "Escape");
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  };

  const confirmDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteScan(scanId);
      if (!res.ok) return setError(res.error);
      dialogRef.current?.close();
      onDeleted(scanId);
    });
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-label={`More actions for ${siteLabel}, scanned ${formatDate(createdAt)}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={`${id}-menu`}
          role="menu"
          aria-label={`Actions for ${siteLabel}`}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            aria-disabled={running}
            onClick={() => {
              if (running) return;
              close(false);
              setError(null);
              dialogRef.current?.showModal();
            }}
            className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${
              running ? "cursor-not-allowed text-slate-400" : "text-red-700 hover:bg-red-50 focus:bg-red-50"
            }`}
          >
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Delete scan
              {running && <span className="block text-xs text-slate-500">Cancel the scan first</span>}
            </span>
          </button>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-5 shadow-xl sm:p-6"
        onClose={() => buttonRef.current?.focus()}
      >
        <h2 id={`${id}-title`} className="text-lg font-semibold text-slate-900">
          Delete this scan?
        </h2>
        <p id={`${id}-desc`} className="mt-2 text-sm text-slate-700">
          The scan of <span className="font-medium">{siteLabel}</span> from {formatDate(createdAt)} will be permanently deleted, including all
          its pages, accessibility issues and Lighthouse results. This can&apos;t be undone.
        </p>
        <p className="mt-2 text-xs text-slate-600">Other scans of this site and your false-positive markings are kept.</p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" autoFocus onClick={() => dialogRef.current?.close()}>
            Cancel
          </Button>
          <Button variant="danger" disabled={pending} onClick={confirmDelete}>
            {pending ? "Deleting..." : "Delete scan"}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
