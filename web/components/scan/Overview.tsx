"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IMPACTS, type Impact, type PageRow, type Scan, type ScanCheck, type ScanSummary, type TopIssue } from "@a11y/shared";
import { browserClient } from "@/lib/supabase";
import { shortPath } from "@/lib/format";
import { Card, ImpactBadge, ScoreBadge, StatCard } from "../ui";

// Status palette from the dataviz reference; "minor" uses neutral muted ink.
const IMPACT_COLOR: Record<Impact, string> = {
  critical: "#d03b3b",
  serious: "#ec835a",
  moderate: "#fab219",
  minor: "#898781",
};
const SERIES_1 = "#2a78d6";

/** True below Tailwind's `sm` breakpoint; false during SSR. */
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

export function Overview({ scan, checks }: { scan: Scan; checks: ScanCheck[] }) {
  const narrow = useNarrow();
  const a11y = checks.includes("accessibility");
  const live = scan.status === "queued" || scan.status === "running";
  const [stats, setStats] = useState<ScanSummary | null>(live ? null : scan.summary);
  const [worst, setWorst] = useState<PageRow[]>([]);

  useEffect(() => {
    const db = browserClient();
    let stop = false;
    const load = async () => {
      const [{ data: s }, { data: w }] = await Promise.all([
        live || !scan.summary ? db.rpc("scan_stats", { p_scan_id: scan.id }) : Promise.resolve({ data: scan.summary }),
        // "Pages needing the most work" ranks by accessibility, so skip it when that wasn't checked.
        !a11y
          ? Promise.resolve({ data: [] })
          : db
              .from("pages")
              .select("id, url, a11y_score, violation_count, critical_count")
              .eq("scan_id", scan.id)
              .eq("crawl_status", "done")
              .order("a11y_score", { ascending: true })
              .order("violation_count", { ascending: false })
              .limit(10),
      ]);
      if (stop) return;
      if (s) setStats(s as ScanSummary);
      setWorst((w as PageRow[]) ?? []);
    };
    load();
    // While the scan runs, refresh the aggregates every 5s (cheaper than reacting to each page update).
    const timer = live ? setInterval(load, 5000) : null;
    return () => {
      stop = true;
      if (timer) clearInterval(timer);
    };
  }, [scan.id, live, scan.summary, a11y]);

  if (!stats) return <p className="text-slate-600">Loading statistics...</p>;

  const totalImpact = IMPACTS.reduce((s, i) => s + (stats.impact_counts?.[i] ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Total pages" value={stats.total_pages} hint={`${stats.scanned_pages} scanned · ${stats.error_pages} errors`} />
        {a11y && <StatCard label="Accessibility score" value={stats.avg_a11y ?? "-"} score={stats.avg_a11y} hint="Average, axe-core" />}
        {checks.includes("seo") && (
          <StatCard label="SEO score" value={stats.avg_seo ?? "-"} score={stats.avg_seo} hint="Average of on-page checks" />
        )}
        {checks.includes("performance") && (
          <StatCard label="Performance score" value={stats.avg_perf ?? "-"} score={stats.avg_perf} hint="Lighthouse where run, else estimated" />
        )}
        {a11y && (
          <StatCard
            label="Accessibility issues"
            value={stats.total_violations}
            hint={stats.dismissed_violations ? `Affected elements · ${stats.dismissed_violations} marked false positive` : "Affected elements"}
          />
        )}
      </div>

      {a11y && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card title="Most common accessibility issues" className="lg:col-span-2">
            {stats.top_issues.length === 0 ? (
              <p className="text-sm text-slate-600">No issues found yet.</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-slate-600">Number of pages affected by each rule</p>
                <div style={{ height: Math.max(200, stats.top_issues.length * 36) }} aria-hidden="true">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.top_issues} layout="vertical" margin={{ left: narrow ? 0 : 8, right: 32, top: 0, bottom: 0 }}>
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="rule_id"
                        width={narrow ? 110 : 170}
                        tickFormatter={(v: string) => (narrow && v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                        tickLine={false}
                        axisLine={{ stroke: "var(--chart-axis-line)" }}
                        tick={{ fill: "var(--chart-axis-text)", fontSize: 12 }}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--chart-cursor)" }}
                        content={({ active, payload }) => {
                          const d = active && (payload?.[0]?.payload as TopIssue | undefined);
                          if (!d) return null;
                          return (
                            <div className="max-w-xs rounded-md border border-slate-200 bg-white p-3 text-xs shadow">
                              <div className="font-semibold text-slate-900">{d.help}</div>
                              <div className="mt-1 text-slate-600">
                                {d.pages} pages · {d.nodes} elements · {d.impact ?? "unknown"} impact
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="pages" fill={SERIES_1} barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                        <LabelList dataKey="pages" position="right" fill="var(--chart-label)" fontSize={12} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Table view of the same data (screen readers + exact values). */}
                <table className="mt-4 w-full text-left text-sm">
                  <caption className="sr-only">Most common accessibility issues</caption>
                  <thead className="text-xs text-slate-600">
                    <tr>
                      <th className="py-1 font-medium">Rule</th>
                      <th className="px-2 py-1 font-medium">Impact</th>
                      <th className="py-1 text-right font-medium">Pages</th>
                      <th className="hidden py-1 text-right font-medium sm:table-cell">Elements</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.top_issues.map((t) => (
                      <tr key={t.rule_id}>
                        <td className="py-1.5">
                          {t.help_url ? (
                            <a href={t.help_url} target="_blank" rel="noreferrer" className="text-blue-700 underline-offset-2 hover:underline">
                              {t.help}
                            </a>
                          ) : (
                            t.help
                          )}
                          <span className="ml-1 text-xs text-slate-500">({t.rule_id})</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <ImpactBadge impact={t.impact} />
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{t.pages}</td>
                        <td className="hidden py-1.5 text-right tabular-nums sm:table-cell">{t.nodes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Card>

          <div className="space-y-6">
            <Card title="Issues by impact">
              {totalImpact === 0 ? (
                <p className="text-sm text-slate-600">No issues found yet.</p>
              ) : (
                <>
                  <div className="flex h-4 gap-0.5 overflow-hidden rounded" aria-hidden="true">
                    {IMPACTS.map((i) =>
                      stats.impact_counts[i] ? (
                        <div
                          key={i}
                          title={`${i}: ${stats.impact_counts[i]}`}
                          style={{ flexGrow: stats.impact_counts[i], background: IMPACT_COLOR[i] }}
                        />
                      ) : null,
                    )}
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {IMPACTS.map((i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm" style={{ background: IMPACT_COLOR[i] }} aria-hidden="true" />
                        <span className="flex-1 capitalize text-slate-800">{i}</span>
                        <span className="tabular-nums text-slate-900">{stats.impact_counts[i] ?? 0}</span>
                        <span className="w-10 text-right text-xs tabular-nums text-slate-500">
                          {Math.round(((stats.impact_counts[i] ?? 0) / totalImpact) * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-500">Counted per rule per page.</p>
                </>
              )}
            </Card>

            <Card title="Pages needing the most work">
              {worst.length === 0 ? (
                <p className="text-sm text-slate-600">No scanned pages yet.</p>
              ) : (
                <ol className="space-y-1 text-sm">
                  {worst.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <ScoreBadge score={p.a11y_score} label="Accessibility" />
                      <Link href={`/scans/${scan.id}/pages/${p.id}`} className="min-w-0 flex-1 truncate text-blue-700 hover:underline" title={p.url}>
                        {shortPath(p.url)}
                      </Link>
                      <span className="text-xs tabular-nums text-slate-600">{p.violation_count} issues</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
