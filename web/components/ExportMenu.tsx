"use client";

import { ChevronDown, Download } from "lucide-react";
import { EXPORT_OPTIONS, exportHref } from "@/lib/export-formats";
import { useMenu } from "./useMenu";

/** Download links for a scan's reports, as menu items. Rendered inside a role="menu" container. */
export function ExportMenuItems({ scanId, disabled, onPick }: { scanId: string; disabled?: boolean; onPick: () => void }) {
  return EXPORT_OPTIONS.map((o) =>
    disabled ? (
      <button
        key={o.query}
        type="button"
        role="menuitem"
        aria-disabled="true"
        className="flex w-full cursor-not-allowed items-start gap-2 px-3 py-2 text-left text-sm text-slate-400"
      >
        <Download className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {o.label}
          <span className="block text-xs text-slate-500">Available when the scan finishes</span>
        </span>
      </button>
    ) : (
      <a
        key={o.query}
        role="menuitem"
        href={exportHref(scanId, o.query)}
        download
        onClick={onPick}
        className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 focus:bg-slate-100"
      >
        <Download className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {o.label}
          <span className="block text-xs text-slate-600">{o.hint}</span>
        </span>
      </a>
    ),
  );
}

/** "Download report" menu button for the scan page. */
export function ExportMenu({ scanId }: { scanId: string }) {
  const { open, close, buttonProps, menuProps } = useMenu();
  return (
    <div className="relative">
      <button
        {...buttonProps}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Download report
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          {...menuProps}
          aria-label="Download report"
          className="absolute right-0 z-10 mt-1 w-72 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          <ExportMenuItems scanId={scanId} onPick={() => close(false)} />
        </div>
      )}
    </div>
  );
}
