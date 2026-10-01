import type { ComponentProps, ReactNode } from "react";
import type { Impact, ScanStatus } from "@a11y/shared";
import { scoreTone } from "@/lib/format";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-blue-700 text-white hover:bg-blue-800",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        variant === "danger" && "border border-red-300 bg-white text-red-700 hover:bg-red-50",
        className,
      )}
    />
  );
}

export function Card({ title, children, className, actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const TONE_CLASSES = {
  good: "bg-green-100 text-green-800",
  ok: "bg-amber-100 text-amber-900",
  bad: "bg-red-100 text-red-800",
  none: "bg-slate-100 text-slate-600",
};

export function ScoreBadge({ score, estimated, label }: { score: number | null | undefined; estimated?: boolean; label?: string }) {
  return (
    <span
      className={cx("inline-flex min-w-10 justify-center rounded px-2 py-0.5 text-xs font-semibold tabular-nums", TONE_CLASSES[scoreTone(score)])}
      title={estimated ? "Estimated from page timings (Lighthouse not run)" : undefined}
      aria-label={label ? `${label}: ${score ?? "not available"}${estimated ? " (estimated)" : ""}` : undefined}
    >
      {score ?? "-"}
      {estimated && score != null ? "*" : ""}
    </span>
  );
}

export function StatCard({ label, value, hint, score }: { label: string; value: ReactNode; hint?: ReactNode; score?: number | null }) {
  const tone = score === undefined ? null : scoreTone(score);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="text-sm text-slate-600">{label}</div>
      <div
        className={cx(
          "mt-1 text-2xl font-bold tabular-nums sm:text-3xl",
          tone === "good" && "text-green-700",
          tone === "ok" && "text-amber-700",
          tone === "bad" && "text-red-700",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

const STATUS_CLASSES: Record<ScanStatus, string> = {
  queued: "bg-slate-100 text-slate-700",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-amber-100 text-amber-900",
};

export function StatusBadge({ status }: { status: ScanStatus }) {
  return <span className={cx("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_CLASSES[status])}>{status}</span>;
}

export const IMPACT_CLASSES: Record<Impact, string> = {
  critical: "bg-red-700 text-white",
  serious: "bg-orange-600 text-white",
  moderate: "bg-amber-200 text-amber-950",
  minor: "bg-slate-200 text-slate-800",
};

export function ImpactBadge({ impact }: { impact: Impact | null }) {
  const i = impact ?? "minor";
  return <span className={cx("rounded px-2 py-0.5 text-xs font-semibold capitalize", IMPACT_CLASSES[i])}>{impact ?? "unknown"}</span>;
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-slate-700">
        <span>{label}</span>
        <span className="tabular-nums">
          {value} / {max} ({pct}%)
        </span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 rounded bg-slate-200">
        <div className="h-2 rounded bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
