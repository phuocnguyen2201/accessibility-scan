import "server-only";
import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { QueueHealth, UsageStats } from "@a11y/shared";
import type { SnapshotOptions } from "@a11y/report";
import type { Range } from "./range";

// Service-role client: the key never leaves the Pi. Only the aggregate admin_* RPCs are called with it.
let client: SupabaseClient | null = null;
function db() {
  client ??= createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function loadStats(range: Range): Promise<UsageStats> {
  const { data, error } = await db().rpc("admin_usage_stats", {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
    p_daily_limit: Number(process.env.DAILY_SCAN_LIMIT) || 15,
  });
  if (error) throw new Error(`admin_usage_stats: ${error.message}`);
  return data as UsageStats;
}

export async function loadHealth(): Promise<QueueHealth> {
  const { data, error } = await db().rpc("admin_queue_health");
  if (error) throw new Error(`admin_queue_health: ${error.message}`);
  return data as QueueHealth;
}

export interface SystemInfo {
  load1: number | null;
  cpus: number | null;
  memUsedPct: number | null;
  memTotalGb: number | null;
  tempC: number | null;
}

/** Host readings from /proc and /sys (Linux / the Pi). All null elsewhere. */
export async function systemInfo(): Promise<SystemInfo> {
  const read = (p: string) => readFile(p, "utf8").catch(() => null);
  const [loadavg, meminfo, temp, cpuinfo] = await Promise.all([
    read("/proc/loadavg"),
    read("/proc/meminfo"),
    read("/sys/class/thermal/thermal_zone0/temp"),
    read("/proc/cpuinfo"),
  ]);
  const kb = (key: string) => Number(meminfo?.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"))?.[1]) || null;
  const total = kb("MemTotal");
  const available = kb("MemAvailable");
  return {
    load1: loadavg ? Number(loadavg.split(" ")[0]) : null,
    cpus: cpuinfo ? cpuinfo.match(/^processor\s*:/gm)?.length ?? null : null,
    memUsedPct: total && available != null ? Math.round(((total - available) / total) * 100) : null,
    memTotalGb: total ? Math.round((total / 1024 / 1024) * 10) / 10 : null,
    tempC: temp ? Math.round(Number(temp) / 100) / 10 : null,
  };
}

/** Snapshot branding from the environment. */
export function snapshotOptions(): SnapshotOptions {
  let appUrl = process.env.SNAPSHOT_APP_URL;
  if (!appUrl && process.env.SITE_URL && !/localhost|127\.0\.0\.1/.test(process.env.SITE_URL)) {
    appUrl = process.env.SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  return { appName: process.env.SNAPSHOT_APP_NAME || "A11y Site Scanner", appUrl, accent: process.env.SNAPSHOT_ACCENT };
}
