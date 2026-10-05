"use client";

import { useEffect, useState } from "react";
import type { QueueHealth } from "@a11y/shared";
import type { SystemInfo } from "@/lib/stats";
import { Card, KeyValue, cx } from "./ui";

interface Health {
  queue: QueueHealth;
  system: SystemInfo;
  at: string;
}

const STALE_MS = 2 * 60_000;

function ago(iso: string | null) {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
}

/** Live queue and worker state, refreshed every 15 seconds. */
export function HealthCard({ initial }: { initial: Health | null }) {
  const [health, setHealth] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setHealth(await res.json());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    if (!initial) load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [initial]);

  if (!health) return <Card title="Workers & queue">{error ?? "Loading..."}</Card>;
  const { queue: q, system: s } = health;
  return (
    <Card title="Workers & queue" hint={`Live · updated ${new Date(health.at).toLocaleTimeString()}${error ? ` · refresh failed (${error})` : ""}`}>
      <KeyValue
        rows={[
          ["Queued scans", q.queued_scans],
          ["Running scans", q.running_scans],
          ["Oldest queued", q.oldest_queued_minutes == null ? "-" : `${q.oldest_queued_minutes} min`],
          ["Lighthouse queued / running", `${q.lighthouse_queued} / ${q.lighthouse_running}`],
        ]}
      />
      <h3 className="mb-1 mt-4 text-sm font-semibold text-slate-900">Workers (last 7 days)</h3>
      {q.workers.length === 0 ? (
        <p className="text-sm text-slate-600">No worker has picked up a scan yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {q.workers.map((w) => {
            const alive = w.running > 0 && w.last_heartbeat && Date.now() - new Date(w.last_heartbeat).getTime() < STALE_MS;
            const stalled = w.running > 0 && !alive;
            return (
              <li key={w.worker_id} className="flex items-center gap-2">
                <span
                  className={cx("h-2.5 w-2.5 rounded-full", alive ? "bg-green-600" : stalled ? "bg-red-600" : "bg-slate-400")}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate text-slate-800">{w.worker_id}</span>
                <span className="text-xs text-slate-600">
                  {stalled ? "stalled" : alive ? `scanning (${w.running})` : "idle"} · {ago(w.last_heartbeat)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {(s.load1 != null || s.tempC != null) && (
        <>
          <h3 className="mb-1 mt-4 text-sm font-semibold text-slate-900">Pi</h3>
          <KeyValue
            rows={[
              ["CPU load (1 min)", s.load1 == null ? "-" : `${s.load1}${s.cpus ? ` / ${s.cpus} cores` : ""}`],
              ["Memory used", s.memUsedPct == null ? "-" : `${s.memUsedPct}% of ${s.memTotalGb} GB`],
              ["Temperature", s.tempC == null ? "-" : `${s.tempC} °C${s.tempC >= 80 ? " (throttling)" : ""}`],
            ]}
          />
        </>
      )}
    </Card>
  );
}
