import Link from "next/link";
import { notFound } from "next/navigation";
import { IMPACTS, type Dismissal, type LighthouseRow, type PageRow, type ViolationRow } from "@a11y/shared";
import { FalsePositiveButton, RestoreButton } from "@/components/FalsePositive";
import { LighthouseButton } from "@/components/LighthouseButton";
import { Card, ImpactBadge, StatCard } from "@/components/ui";
import { formatBytes, formatDate, formatMs } from "@/lib/format";
import { serverClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function PageDetail({ params }: { params: Promise<{ scanId: string; pageId: string }> }) {
  const { scanId, pageId } = await params;
  const db = await serverClient();
  const [{ data: page }, { data: violations }, { data: lighthouse }] = await Promise.all([
    db.from("pages").select("*").eq("id", pageId).eq("scan_id", scanId).maybeSingle(),
    db.from("violations").select("*, dismissal:dismissals(id, page_key, reason, created_at)").eq("page_id", pageId),
    db.from("lighthouse_results").select("*").eq("page_id", pageId).maybeSingle(),
  ]);
  if (!page) notFound();
  const p = page as PageRow;
  const lh = lighthouse as LighthouseRow | null;
  const vs = ((violations as ViolationWithDismissal[]) ?? []).sort(
    (a, b) => IMPACTS.indexOf(a.impact ?? "minor") - IMPACTS.indexOf(b.impact ?? "minor") || b.node_count - a.node_count,
  );
  const active = vs.filter((v) => !v.dismissal_id);
  const dismissed = vs.filter((v) => v.dismissal_id);
  let emptyMessage = "No axe violations found on this page.";
  if (p.crawl_status !== "done") emptyMessage = "This page was not scanned.";
  else if (dismissed.length) emptyMessage = "No remaining axe violations on this page.";

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href={`/scans/${scanId}?tab=pages`} className="text-blue-700 hover:underline">
          ← Back to all pages
        </Link>
      </nav>

      <div>
        <h1 className="break-all text-2xl font-bold text-slate-900">{p.title || p.url}</h1>
        <p className="mt-1 text-sm text-slate-600">
          <a href={p.url} target="_blank" rel="noreferrer" className="break-all text-blue-700 hover:underline">
            {p.url}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          {" · "}HTTP {p.http_status ?? "-"} · Depth {p.depth} · Scanned {formatDate(p.scanned_at)}
        </p>
        {p.error && <p className="mt-2 text-sm text-red-700">{p.error}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Accessibility" value={p.a11y_score ?? "-"} score={p.a11y_score} hint={lh?.accessibility != null ? `Lighthouse: ${lh.accessibility}` : "axe-core"} />
        <StatCard label="SEO" value={p.seo_score ?? "-"} score={p.seo_score} hint={lh?.seo != null ? `Lighthouse: ${lh.seo}` : "On-page checks"} />
        <StatCard label="Performance" value={p.perf_score ?? "-"} score={p.perf_score} hint={p.perf_estimated ? "Estimated - run Lighthouse for a real score" : "Lighthouse (desktop)"} />
        <StatCard
          label="Accessibility issues"
          value={p.violation_count}
          hint={`${active.length} rules failed · ${p.critical_count} critical elements${dismissed.length ? ` · ${dismissed.length} false positives` : ""}`}
        />
      </div>

      <Card title={`Accessibility issues (${active.length} rules)`}>
        {active.length === 0 ? (
          <p className="text-sm text-slate-600">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3">
            {active.map((v) => (
              <li key={v.id} className="flex items-start gap-2 rounded-md border border-slate-200">
                <ViolationDetails v={v} />
                <div className="shrink-0 p-2">
                  <FalsePositiveButton violationId={v.id} ruleHelp={v.help} ruleId={v.rule_id} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {dismissed.length > 0 && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Marked as false positive ({dismissed.length})</h3>
            <p className="mb-3 text-xs text-slate-600">Excluded from this page&apos;s score and from the dashboard.</p>
            <ul className="space-y-2">
              {dismissed.map((v) => (
                <li key={v.id} className="flex items-start gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <ViolationDetails v={v} muted />
                    <p className="px-3 pb-3 text-xs text-slate-600">
                      {v.dismissal?.page_key === "" ? "Hidden on every page of this site" : "Hidden on this page"}
                      {v.dismissal?.created_at && ` · ${formatDate(v.dismissal.created_at)}`}
                      {v.dismissal?.reason && (
                        <>
                          {" · "}
                          <span className="italic">“{v.dismissal.reason}”</span>
                        </>
                      )}
                    </p>
                  </div>
                  {v.dismissal && (
                    <div className="shrink-0 p-2">
                      <RestoreButton dismissalId={v.dismissal.id} ruleHelp={v.help} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Performance" actions={<LighthouseButton pageId={p.id} status={p.lighthouse_status} />}>
          {lh ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Metric label="Largest Contentful Paint" value={formatMs(lh.lcp)} />
              <Metric label="First Contentful Paint" value={formatMs(lh.fcp)} />
              <Metric label="Total Blocking Time" value={formatMs(lh.tbt)} />
              <Metric label="Cumulative Layout Shift" value={lh.cls?.toFixed(3) ?? "-"} />
              <Metric label="Speed Index" value={formatMs(lh.speed_index)} />
              <Metric label="Best practices" value={lh.best_practices ?? "-"} />
            </dl>
          ) : (
            <p className="mb-3 text-sm text-slate-600">Lighthouse has not run on this page. Basic timings from the crawl:</p>
          )}
          {p.perf_metrics && (
            <dl className={`grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 ${lh ? "mt-4 border-t border-slate-100 pt-4" : ""}`}>
              <Metric label="Time to first byte" value={formatMs(p.perf_metrics.ttfb)} />
              <Metric label="DOM content loaded" value={formatMs(p.perf_metrics.domContentLoaded)} />
              <Metric label="Load" value={formatMs(p.perf_metrics.load)} />
              <Metric label="Transfer size" value={formatBytes(p.perf_metrics.transferSize)} />
              <Metric label="Requests" value={p.perf_metrics.requestCount ?? "-"} />
            </dl>
          )}
        </Card>

        <Card title="SEO checks">
          {p.seo_checks?.length ? (
            <ul className="space-y-2 text-sm">
              {p.seo_checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <span aria-hidden="true" className={c.passed ? "text-green-700" : "text-red-700"}>
                    {c.passed ? "✓" : "✗"}
                  </span>
                  <div>
                    <span className="font-medium text-slate-900">{c.label}</span>
                    <span className="sr-only">{c.passed ? " - passed" : " - failed"}</span>
                    <div className="break-all text-xs text-slate-600">{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No SEO data for this page.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

type ViolationWithDismissal = ViolationRow & {
  dismissal: Pick<Dismissal, "id" | "page_key" | "reason" | "created_at"> | null;
};

function ViolationDetails({ v, muted }: { v: ViolationRow; muted?: boolean }) {
  return (
    <details className="min-w-0 flex-1">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3">
        <ImpactBadge impact={v.impact} />
        <span className={`font-medium ${muted ? "text-slate-600 line-through decoration-slate-400" : "text-slate-900"}`}>{v.help}</span>
        <span className="text-xs text-slate-500">
          {v.rule_id} · {v.node_count} element{v.node_count === 1 ? "" : "s"}
        </span>
      </summary>
      <div className="space-y-3 border-t border-slate-200 p-3 text-sm">
        <p className="text-slate-700">{v.description}</p>
        <div className="flex flex-wrap gap-1">
          {v.wcag_tags.map((t) => (
            <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
              {t}
            </span>
          ))}
          {v.help_url && (
            <a href={v.help_url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-blue-700 hover:underline">
              How to fix (Deque University)<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
        {v.nodes.map((n, i) => (
          <div key={i} className="rounded bg-slate-50 p-2">
            <div className="text-xs font-medium text-slate-700">
              Selector: <code className="break-all">{n.target}</code>
            </div>
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-slate-900 p-2 text-xs text-slate-100">{n.html}</pre>
            {n.failureSummary && <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{n.failureSummary}</p>}
          </div>
        ))}
        {v.node_count > v.nodes.length && <p className="text-xs text-slate-500">+ {v.node_count - v.nodes.length} more elements not stored</p>}
      </div>
    </details>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
