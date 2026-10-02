import Link from "next/link";
import { notFound } from "next/navigation";
import { IMPACTS, SCAN_CHECKS, type Dismissal, type LighthouseRow, type PageRow, type ScanCheck } from "@a11y/shared";
import { FalsePositiveButton, RestoreButton } from "@/components/FalsePositive";
import { LighthouseButton } from "@/components/LighthouseButton";
import { Card, StatCard } from "@/components/ui";
import { ViolationDetails, type ViolationSummary } from "@/components/ViolationDetails";
import { formatBytes, formatDate, formatMs } from "@/lib/format";
import { serverClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function PageDetail({ params }: { params: Promise<{ scanId: string; pageId: string }> }) {
  const { scanId, pageId } = await params;
  const db = await serverClient();
  const [{ data: page }, { data: violations }, { data: lighthouse }, { data: scan }] = await Promise.all([
    db.from("pages").select("*").eq("id", pageId).eq("scan_id", scanId).maybeSingle(),
    // Skip `nodes` (the stored elements): ViolationDetails fetches them one at a time when an issue is expanded.
    db.from("violations").select(VIOLATION_COLUMNS).eq("page_id", pageId),
    db.from("lighthouse_results").select("*").eq("page_id", pageId).maybeSingle(),
    db.from("scans").select("checks").eq("id", scanId).maybeSingle<{ checks: ScanCheck[] | null }>(),
  ]);
  if (!page) notFound();
  const checks: readonly ScanCheck[] = scan?.checks?.length ? scan.checks : SCAN_CHECKS;
  const a11y = checks.includes("accessibility");
  const seo = checks.includes("seo");
  const perf = checks.includes("performance");
  const bestPractices = checks.includes("best-practices");
  const p = page as PageRow;
  const lh = lighthouse as LighthouseRow | null;
  const vs = ((violations as unknown as ViolationWithDismissal[] | null) ?? []).sort(
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
        <h1 className="break-all text-xl font-bold text-slate-900 sm:text-2xl">{p.title || p.url}</h1>
        <p className="mt-1 text-sm text-slate-600">
          <a href={p.url} target="_blank" rel="noreferrer" className="break-all text-blue-700 hover:underline">
            {p.url}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          {" · "}HTTP {p.http_status ?? "-"} · Depth {p.depth} · Scanned {formatDate(p.scanned_at)}
        </p>
        {p.error && <p className="mt-2 text-sm text-red-700">{p.error}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {a11y && (
          <StatCard label="Accessibility" value={p.a11y_score ?? "-"} score={p.a11y_score} hint={lh?.accessibility != null ? `Lighthouse: ${lh.accessibility}` : "axe-core"} />
        )}
        {seo && <StatCard label="SEO" value={p.seo_score ?? "-"} score={p.seo_score} hint={lh?.seo != null ? `Lighthouse: ${lh.seo}` : "On-page checks"} />}
        {perf && (
          <StatCard label="Performance" value={p.perf_score ?? "-"} score={p.perf_score} hint={p.perf_estimated ? "Estimated - run Lighthouse for a real score" : "Lighthouse (desktop)"} />
        )}
        {bestPractices && (
          <StatCard label="Best practices" value={lh?.best_practices ?? "-"} score={lh?.best_practices ?? null} hint={lh ? "Lighthouse" : "Run Lighthouse to score"} />
        )}
        {a11y && (
          <StatCard
            label="Accessibility issues"
            value={p.violation_count}
            hint={`${active.length} rules failed · ${p.critical_count} critical elements${dismissed.length ? ` · ${dismissed.length} false positives` : ""}`}
          />
        )}
      </div>

      {a11y && (
        <Card title={`Accessibility issues (${active.length} rules)`}>
          {active.length === 0 ? (
            <p className="text-sm text-slate-600">{emptyMessage}</p>
          ) : (
            <ul className="space-y-3">
              {active.map((v) => (
                <li key={v.id} className="flex flex-col gap-2 rounded-md border border-slate-200 sm:flex-row sm:items-start">
                  <ViolationDetails v={v} />
                  <div className="shrink-0 px-3 pb-3 sm:p-2">
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
                  <li key={v.id} className="flex flex-col gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 sm:flex-row sm:items-start">
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
                      <div className="shrink-0 px-3 pb-3 sm:p-2">
                        <RestoreButton dismissalId={v.dismissal.id} ruleHelp={v.help} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={perf ? "Performance" : "Lighthouse"} actions={<LighthouseButton pageId={p.id} status={p.lighthouse_status} />}>
          {lh && perf ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Metric label="Largest Contentful Paint" value={formatMs(lh.lcp)} />
              <Metric label="First Contentful Paint" value={formatMs(lh.fcp)} />
              <Metric label="Total Blocking Time" value={formatMs(lh.tbt)} />
              <Metric label="Cumulative Layout Shift" value={lh.cls?.toFixed(3) ?? "-"} />
              <Metric label="Speed Index" value={formatMs(lh.speed_index)} />
              {bestPractices && <Metric label="Best practices" value={lh.best_practices ?? "-"} />}
            </dl>
          ) : lh ? (
            <p className="text-sm text-slate-600">Lighthouse ran on this page; its scores are shown above.</p>
          ) : (
            <p className="mb-3 text-sm text-slate-600">
              Lighthouse has not run on this page.{p.perf_metrics ? " Basic timings from the crawl:" : ""}
            </p>
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

        {seo && (
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
        )}
      </div>
    </div>
  );
}

const VIOLATION_COLUMNS =
  "id, page_id, scan_id, rule_id, impact, description, help, help_url, wcag_tags, node_count, dismissal_id, dismissal:dismissals(id, page_key, reason, created_at)";

type ViolationWithDismissal = ViolationSummary & {
  dismissal: Pick<Dismissal, "id" | "page_key" | "reason" | "created_at"> | null;
};

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
