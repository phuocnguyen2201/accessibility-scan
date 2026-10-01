"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ViolationNode, ViolationRow } from "@a11y/shared";
import { browserClient } from "@/lib/supabase";
import { ImpactBadge } from "./ui";

/** Violation without its stored elements; those are fetched one at a time when the issue is expanded. */
export type ViolationSummary = Omit<ViolationRow, "nodes">;

export function ViolationDetails({ v, muted }: { v: ViolationSummary; muted?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="min-w-0 flex-1" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3">
        <ImpactBadge impact={v.impact} />
        <span className={`font-medium ${muted ? "text-slate-600 line-through decoration-slate-400" : "text-slate-900"}`}>{v.help}</span>
        <span className="text-xs text-slate-500">
          {v.rule_id} · {v.node_count} element{v.node_count === 1 ? "" : "s"}
        </span>
      </summary>
      <div className="space-y-3 border-t border-slate-200 p-3 text-sm">
        <p className="text-slate-700">{v.description}</p>
        <div className="flex flex-wrap items-center gap-1">
          {v.wcag_tags.map((t) => (
            <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
              {t}
            </span>
          ))}
          {v.help_url && (
            <a href={v.help_url} target="_blank" rel="noreferrer" className="ml-2 text-sm font-medium text-blue-700 hover:underline">
              How to fix (Deque University)<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
        {open && v.node_count > 0 && <Occurrences violationId={v.id} total={v.node_count} />}
      </div>
    </details>
  );
}

/** undefined = not fetched yet, null = not stored (past the worker's per-rule cap). */
type Slot = ViolationNode | null | undefined;

function Occurrences({ violationId, total }: { violationId: string; total: number }) {
  const [index, setIndex] = useState(0);
  const [cache, setCache] = useState<Map<number, ViolationNode | null>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(new Set<number>());

  const load = useCallback(
    async (i: number) => {
      if (i >= total || cache.has(i) || inflight.current.has(i)) return;
      inflight.current.add(i);
      // `nodes->i` makes PostgREST return just that array element, not the whole list.
      const { data, error } = await browserClient().from("violations").select(`node:nodes->${i}`).eq("id", violationId).maybeSingle();
      inflight.current.delete(i);
      if (error) return setError(error.message);
      setCache((prev) => new Map(prev).set(i, ((data as { node: ViolationNode | null } | null)?.node ?? null)));
    },
    [violationId, total, cache],
  );

  // Load the current element and prefetch the next so "Next" feels instant.
  useEffect(() => {
    load(index);
    load(index + 1);
  }, [index, load]);

  const current: Slot = cache.get(index);
  const nextSlot: Slot = cache.get(index + 1);
  const hasNext = index + 1 < total && nextSlot !== null;
  // Index of the first element that wasn't stored, once we've found it.
  const storedCount = [...cache].find(([, n]) => n === null)?.[0];

  return (
    <section aria-label="Affected elements" className="rounded-md border border-slate-200">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <button
          type="button"
          onClick={() => setIndex((i) => i - 1)}
          disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous<span className="sr-only"> element</span>
        </button>
        <p className="text-sm font-medium tabular-nums text-slate-800" aria-live="polite">
          Element {index + 1} of {total}
        </p>
        <button
          type="button"
          onClick={() => setIndex((i) => i + 1)}
          disabled={!hasNext}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next<span className="sr-only"> element</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-3 p-3">
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            Couldn&apos;t load this element: {error}
          </p>
        ) : current === undefined ? (
          <p className="text-sm text-slate-600">Loading...</p>
        ) : current === null ? (
          <p className="text-sm text-slate-600">Details for this element weren&apos;t stored.</p>
        ) : (
          <>
            {current.failureSummary && <FailureSummary text={current.failureSummary} />}
            <div>
              <div className="text-xs font-medium text-slate-700">Selector</div>
              <code className="mt-0.5 block break-all text-xs text-slate-800">{current.target}</code>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-700">HTML</div>
              <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap break-all rounded bg-slate-900 p-2 text-xs text-slate-100">{current.html}</pre>
            </div>
          </>
        )}
        {storedCount !== undefined && storedCount < total && (
          <p className="text-xs text-slate-500">
            Details are kept for the first {storedCount} of {total} elements.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * axe's failure summary, e.g.
 *   "Fix any of the following:\n  Element has insufficient color contrast of 4.15 (foreground color: #0079c2, ...)"
 * Group headings become labels; each reason is a bullet with its root-cause values highlighted.
 */
function FailureSummary({ text }: { text: string }) {
  const groups: { heading: string | null; items: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^Fix (any|all) of the following:?$/i.test(line)) groups.push({ heading: line.replace(/:?$/, ":"), items: [] });
    else (groups.at(-1) ?? groups[groups.push({ heading: null, items: [] }) - 1]).items.push(line);
  }
  return (
    <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900">Why it fails</h4>
      {groups.map((g, i) => (
        <div key={i} className="mt-1">
          {g.heading && <p className="text-sm text-slate-700">{g.heading}</p>}
          <ul className="mt-1 list-disc space-y-1 pl-5 text-base leading-relaxed text-slate-900">
            {g.items.map((item, j) => (
              <li key={j}>
                <Highlighted text={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Root-cause values in axe messages. Order matters: the first matching group wins.
const TOKENS: { re: string; kind: "actual" | "expected" | "color" | "font" | "quoted" }[] = [
  { re: String.raw`(?<=contrast of )\d+(?:\.\d+)?(?::1)?`, kind: "actual" },
  { re: String.raw`(?<=Expected contrast ratio of )\d+(?:\.\d+)?:1`, kind: "expected" },
  { re: String.raw`#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)`, kind: "color" },
  { re: String.raw`(?<=font size: )\d+(?:\.\d+)?pt(?: \(\d+(?:\.\d+)?px\))?`, kind: "font" },
  { re: String.raw`(?<=font weight: )\w+`, kind: "font" },
  { re: String.raw`"[^"\n]+"`, kind: "quoted" },
];
const TOKEN_RE = new RegExp(TOKENS.map((t) => `(${t.re})`).join("|"), "g");

const TOKEN_CLASS = {
  actual: "rounded bg-red-100 px-1 font-bold text-red-800",
  expected: "rounded bg-green-100 px-1 font-bold text-green-800",
  color: "inline-flex items-center gap-1 rounded bg-white px-1 font-mono font-bold text-slate-900 ring-1 ring-slate-300",
  font: "rounded bg-blue-100 px-1 font-bold text-blue-900",
  quoted: "font-semibold text-slate-900",
};

function Highlighted({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const kind = TOKENS[m.slice(1).findIndex((g) => g !== undefined)].kind;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <strong key={m.index} className={TOKEN_CLASS[kind]}>
        {kind === "color" && <span className="inline-block h-3 w-3 rounded-sm ring-1 ring-slate-400" style={{ background: m[0] }} aria-hidden="true" />}
        {m[0]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}
