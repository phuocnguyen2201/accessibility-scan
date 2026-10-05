import { Download } from "lucide-react";
import { growth, rangeLabel } from "@a11y/report";
import type { UsageStats } from "@a11y/shared";
import { DailyChart, HoursChart, MauChart } from "@/components/Charts";
import { HealthCard } from "@/components/HealthCard";
import { RangePicker } from "@/components/RangePicker";
import { Card, KeyValue, Meter, StatCard, fmt, pct } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { parseRange, rangeQuery } from "@/lib/range";
import { loadHealth, loadStats, systemInfo } from "@/lib/stats";

export const dynamic = "force-dynamic";

const th = "py-1 font-medium";
const num = "py-1.5 text-right tabular-nums";

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const range = parseRange(await searchParams);
  const q = rangeQuery(range);

  let stats: UsageStats;
  try {
    stats = await loadStats(range);
  } catch (err) {
    return (
      <Card title="Couldn't load statistics">
        <p className="text-sm text-red-700">{err instanceof Error ? err.message : String(err)}</p>
        <p className="mt-2 text-sm text-slate-600">
          Check SUPABASE_SERVICE_ROLE_KEY in the Pi&apos;s .env and that the migration <code>20261005000000_admin_stats.sql</code> is applied.
        </p>
      </Card>
    );
  }
  const [queue, system] = await Promise.all([loadHealth().catch(() => null), systemInfo()]);

  const { kpis: k, engagement: e, scan_time: t, limits: l, features: f, reliability: r, findings: fd } = stats;
  const mauGrowth = growth(stats.monthly);
  const lastMonth = stats.monthly.at(-1);
  const finished = r.completed + r.failed;

  const exports = [
    ["Excel", `/export?format=xlsx&${q}`],
    ["CSV (monthly)", `/export?format=csv&table=monthly&${q}`],
    ["CSV (daily)", `/export?format=csv&table=daily&${q}`],
    ["CSV (summary)", `/export?format=csv&table=summary&${q}`],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usage</h1>
          <p className="text-sm text-slate-600">{rangeLabel(stats)} · aggregate statistics only, no user or site data</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {exports.map(([label, href]) => (
            <a key={label} href={href} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50">
              <Download className="h-4 w-4" aria-hidden="true" />
              {label}
            </a>
          ))}
          <a href={`/snapshot?${q}`} className="inline-flex items-center rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800">
            LinkedIn snapshot
          </a>
        </div>
      </div>

      <RangePicker range={range} path="/" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={lastMonth ? `Monthly active users (${lastMonth.month})` : "Active users"}
          value={fmt(lastMonth?.mau ?? k.active_users)}
          delta={mauGrowth}
          hint={`${fmt(k.active_users)} active in the period`}
        />
        <StatCard label="Registered users" value={fmt(k.registered_users)} hint={`${fmt(k.new_signups)} new in the period · ${fmt(k.guest_users)} guests`} />
        <StatCard label="Scanning time" value={`${fmt(k.scan_hours, 1)} h`} hint={`${fmt(k.scans)} scans · ${fmt(k.lighthouse_runs)} Lighthouse runs`} />
        <StatCard label="Pages scanned" value={fmt(k.pages_scanned)} hint={`${fmt(fd.issues_found)} accessibility issues found`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Monthly active users" hint="Users with at least one scan in the month" className="lg:col-span-2">
          <MauChart monthly={stats.monthly} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-slate-700">Table view</summary>
            <table className="mt-2 w-full text-left">
              <thead className="text-xs text-slate-600">
                <tr>
                  <th className={th}>Month</th>
                  <th className={`${th} text-right`}>MAU</th>
                  <th className={`${th} text-right`}>New</th>
                  <th className={`${th} text-right`}>Returning</th>
                  <th className={`${th} text-right`}>Sign-ups</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.monthly.map((m) => (
                  <tr key={m.month}>
                    <td className="py-1.5">{m.month}</td>
                    <td className={num}>{m.mau}</td>
                    <td className={num}>{m.new_users}</td>
                    <td className={num}>{m.mau - m.new_users}</td>
                    <td className={num}>{m.signups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>
        <Card title="Engagement">
          <KeyValue
            rows={[
              ["MAU growth (last month)", mauGrowth == null ? "-" : `${mauGrowth >= 0 ? "+" : ""}${mauGrowth}%`],
              ["Active users in period", fmt(k.active_users)],
              ["Returning users (2+ scans)", `${fmt(e.returning_users)} (${pct(e.returning_users, k.active_users)})`],
              ["Stickiness (DAU / MAU)", e.stickiness == null ? "-" : `${Math.round(e.stickiness * 1000) / 10}%`],
              ["Guests who created an account", `${fmt(e.converted_guests)} of ${fmt(e.total_guests_ever)} (${pct(e.converted_guests, e.total_guests_ever)})`],
            ]}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Scanning time per month" hint="Wall-clock hours from start to finish of each scan" className="lg:col-span-2">
          <HoursChart monthly={stats.monthly} />
        </Card>
        <Card title="Scan profile">
          <KeyValue
            rows={[
              ["Average scan", t.avg_minutes == null ? "-" : `${t.avg_minutes} min`],
              ["Median scan", t.median_minutes == null ? "-" : `${t.median_minutes} min`],
              ["Average pages per scan", fmt(t.avg_pages, 1)],
              ["Throughput", t.pages_per_hour == null ? "-" : `${fmt(t.pages_per_hour)} pages / h`],
              ["Lighthouse runs", fmt(k.lighthouse_runs)],
            ]}
          />
        </Card>
      </div>

      <Card title="Scans per day" hint="By outcome">
        <DailyChart daily={stats.daily} />
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Feature usage" hint={`Share of ${fmt(f.scans)} scans`}>
          <ul className="space-y-3">
            <Meter label="Accessibility" part={f.accessibility} whole={f.scans} />
            <Meter label="SEO" part={f.seo} whole={f.scans} />
            <Meter label="Performance" part={f.performance} whole={f.scans} />
            <Meter label="Best practices" part={f.best_practices} whole={f.scans} />
            <Meter label="Email report requested" part={f.email_opt_in} whole={f.scans} />
          </ul>
        </Card>
        <Card title="Limits">
          <KeyValue
            rows={[
              [`Daily limit (${l.daily_limit} scans) reached`, `${fmt(l.limit_reached)} times`],
              ["Guest scans", `${fmt(l.guest_scans)} (${pct(l.guest_scans, l.guest_scans + l.registered_scans)})`],
              ["Registered-user scans", fmt(l.registered_scans)],
            ]}
          />
          <p className="mt-3 text-xs text-slate-600">
            Reaching the limit often is a sign users want more: a candidate for a paid tier.
          </p>
        </Card>
        <Card title="Reliability">
          <KeyValue
            rows={[
              ["Completed", fmt(r.completed)],
              ["Failed", `${fmt(r.failed)} (${pct(r.failed, finished)})`],
              ["Cancelled by user", fmt(r.cancelled)],
              ["Report emails sent / failed", `${fmt(f.emails_sent)} / ${fmt(f.emails_failed)}`],
            ]}
          />
          {r.errors.length > 0 && (
            <>
              <h3 className="mb-1 mt-4 text-sm font-semibold text-slate-900">Failure causes</h3>
              <KeyValue rows={r.errors.map((x) => [x.category, fmt(x.count)] as [string, string])} />
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Most common accessibility issues" hint={`Across ${fmt(fd.pages_checked)} audited pages`} className="lg:col-span-2">
          {fd.top_rules.length === 0 ? (
            <p className="text-sm text-slate-600">No accessibility issues in this period.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-600">
                <tr>
                  <th className={th}>Issue</th>
                  <th className={`${th} text-right`}>Pages</th>
                  <th className={`${th} text-right`}>Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fd.top_rules.map((x) => (
                  <tr key={x.rule_id}>
                    <td className="py-1.5">
                      {x.help} <span className="text-xs text-slate-500">({x.rule_id})</span>
                    </td>
                    <td className={num}>{fmt(x.pages)}</td>
                    <td className={num}>{pct(x.pages, fd.pages_checked)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-sm text-slate-600">
            Average scores: accessibility {fd.avg_a11y ?? "-"} · SEO {fd.avg_seo ?? "-"} · performance {fd.avg_perf ?? "-"}
          </p>
        </Card>
        <HealthCard initial={queue ? { queue, system, at: new Date().toISOString() } : null} />
      </div>
    </div>
  );
}
