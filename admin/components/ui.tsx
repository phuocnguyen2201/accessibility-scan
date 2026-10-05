import type { ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null ? "-" : n.toLocaleString("en-US", { maximumFractionDigits: digits });
export const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : "-");

export function Card({ title, children, className, actions, hint }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode; hint?: ReactNode }) {
  return (
    <section className={cx("rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {hint && <p className="mt-0.5 text-xs text-slate-600">{hint}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, delta }: { label: string; value: ReactNode; hint?: ReactNode; delta?: number | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900 sm:text-3xl">{value}</span>
        {delta != null && (
          <span className={cx("text-sm font-semibold", delta >= 0 ? "text-green-700" : "text-red-700")}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%<span className="sr-only"> month over month</span>
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

/** A labelled share bar (feature usage etc.). Value is printed, so the bar is decorative. */
export function Meter({ label, part, whole }: { label: string; part: number; whole: number }) {
  const share = whole > 0 ? part / whole : 0;
  return (
    <li>
      <div className="flex justify-between text-sm">
        <span className="text-slate-800">{label}</span>
        <span className="tabular-nums text-slate-900">
          {pct(part, whole)} <span className="text-xs text-slate-500">({fmt(part)})</span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-slate-100" aria-hidden="true">
        <div className="h-full rounded" style={{ width: `${share * 100}%`, background: "var(--series-1)" }} />
      </div>
    </li>
  );
}

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-1.5">
          <dt className="text-slate-600">{k}</dt>
          <dd className="text-right font-medium tabular-nums text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
