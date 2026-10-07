"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { UsageDay, UsageMonth } from "@a11y/shared";

// Charts follow the dataviz reference: categorical slots 1-2 for series, the fixed status palette for scan
// outcomes, recessive axes, a legend for 2+ series, hover tooltips, and a table view below each chart.

// "2026-09" → "Sep/26". Mirrors monthLabel in @a11y/report, which can't be imported client-side (exceljs/playwright).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthShort = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const axis = { tickLine: false, axisLine: { stroke: "var(--chart-axis-line)" }, tick: { fill: "var(--chart-axis-text)", fontSize: 12 } } as const;
const grid = <CartesianGrid vertical={false} stroke="var(--chart-axis-line)" strokeOpacity={0.4} />;
const legend = <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "var(--chart-axis-text)" }} />;
// 2px surface gap between stacked segments.
const gap = { stroke: "var(--chart-surface)", strokeWidth: 2 };

function TooltipBox({ title, rows }: { title: string; rows: [string, string, string?][] }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2.5 text-xs shadow">
      <div className="mb-1 font-semibold text-slate-900">{title}</div>
      {rows.map(([label, value, color]) => (
        <div key={label} className="flex items-center gap-2 text-slate-700">
          {color && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />}
          <span className="flex-1">{label}</span>
          <span className="font-medium tabular-nums text-slate-900">{value}</span>
        </div>
      ))}
    </div>
  );
}

/** Monthly active users split into returning and new. */
export function MauChart({ monthly }: { monthly: UsageMonth[] }) {
  const data = monthly.map((m) => ({ ...m, label: monthShort(m.month), returning: m.mau - m.new_users }));
  return (
    <div className="h-64" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          {grid}
          <XAxis dataKey="label" {...axis} />
          <YAxis allowDecimals={false} {...axis} axisLine={false} />
          <Tooltip
            cursor={{ fill: "var(--chart-cursor)" }}
            content={({ active, payload }) => {
              const d = active && (payload?.[0]?.payload as (typeof data)[number] | undefined);
              if (!d) return null;
              return (
                <TooltipBox
                  title={`${d.label}: ${d.mau} active users`}
                  rows={[
                    ["Returning", String(d.returning), "var(--series-1)"],
                    ["New", String(d.new_users), "var(--series-2)"],
                    ["Sign-ups", String(d.signups)],
                  ]}
                />
              );
            }}
          />
          {legend}
          <Bar dataKey="returning" name="Returning users" stackId="u" fill="var(--series-1)" {...gap} isAnimationActive={false} />
          <Bar dataKey="new_users" name="New users" stackId="u" fill="var(--series-2)" {...gap} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Hours of scanning per month (single series). */
export function HoursChart({ monthly }: { monthly: UsageMonth[] }) {
  const data = monthly.map((m) => ({ label: monthShort(m.month), hours: Math.round((m.scan_minutes / 60) * 10) / 10, pages: m.pages, scans: m.scans }));
  return (
    <div className="h-56" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          {grid}
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} axisLine={false} />
          <Tooltip
            cursor={{ fill: "var(--chart-cursor)" }}
            content={({ active, payload }) => {
              const d = active && (payload?.[0]?.payload as (typeof data)[number] | undefined);
              if (!d) return null;
              return (
                <TooltipBox
                  title={d.label}
                  rows={[
                    ["Hours scanned", String(d.hours)],
                    ["Scans", d.scans.toLocaleString()],
                    ["Pages", d.pages.toLocaleString()],
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="hours" name="Hours scanned" fill="var(--series-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const STATUS = [
  { key: "completed", name: "Completed", color: "var(--status-good)" },
  { key: "failed", name: "Failed", color: "var(--status-critical)" },
  { key: "cancelled", name: "Cancelled", color: "var(--status-muted)" },
  { key: "in_progress", name: "In progress", color: "var(--series-1)" },
] as const;

/** Scans per day stacked by outcome. */
export function DailyChart({ daily }: { daily: UsageDay[] }) {
  const data = daily.map((d) => ({ ...d, label: d.day.slice(5) }));
  return (
    <div className="h-64" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={1}>
          {grid}
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis allowDecimals={false} {...axis} axisLine={false} />
          <Tooltip
            cursor={{ fill: "var(--chart-cursor)" }}
            content={({ active, payload }) => {
              const d = active && (payload?.[0]?.payload as (typeof data)[number] | undefined);
              if (!d) return null;
              return (
                <TooltipBox
                  title={`${d.day} · ${d.active_users} active users`}
                  rows={STATUS.map((s) => [s.name, String(d[s.key]), s.color] as [string, string, string])}
                />
              );
            }}
          />
          {legend}
          {STATUS.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="s"
              fill={s.color}
              radius={i === STATUS.length - 1 ? [3, 3, 0, 0] : undefined}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
