// Date ranges for the dashboard, in UTC. `to` is exclusive internally; in the URL it is the last day included.

export interface Range {
  from: Date;
  to: Date;
  preset: Preset | null;
}

export const PRESETS = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "last-month": "Last month",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  all: "All time",
} as const;
export type Preset = keyof typeof PRESETS;

const DAY = 86_400_000;
const MAX_DAYS = 3 * 366;
/** The first day anything can have been scanned. */
const EPOCH = new Date(Date.UTC(2026, 0, 1));

const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const monthsBack = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1));
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function parseDay(v: string | undefined) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function presetRange(preset: Preset, now = new Date()): Range {
  const tomorrow = new Date(startOfDay(now).getTime() + DAY);
  switch (preset) {
    case "30d":
      return { from: new Date(tomorrow.getTime() - 30 * DAY), to: tomorrow, preset };
    case "90d":
      return { from: new Date(tomorrow.getTime() - 90 * DAY), to: tomorrow, preset };
    case "last-month":
      return { from: monthsBack(now, 1), to: monthsBack(now, 0), preset };
    case "6m":
      return { from: monthsBack(now, 5), to: tomorrow, preset };
    case "all":
      return { from: EPOCH, to: tomorrow, preset };
    default:
      return { from: monthsBack(now, 11), to: tomorrow, preset: "12m" };
  }
}

/** ?preset=6m, or ?from=YYYY-MM-DD&to=YYYY-MM-DD (to inclusive). Defaults to the last 12 months. */
export function parseRange(params: Record<string, string | string[] | undefined>, fallback: Preset = "12m"): Range {
  const get = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const preset = get("preset");
  if (preset && preset in PRESETS) return presetRange(preset as Preset);
  const from = parseDay(get("from"));
  const toDay = parseDay(get("to"));
  if (from && toDay) {
    const to = new Date(toDay.getTime() + DAY);
    if (to > from && (to.getTime() - from.getTime()) / DAY <= MAX_DAYS) return { from, to, preset: null };
  }
  return presetRange(fallback);
}

/** Query string that reproduces the range. */
export function rangeQuery(r: Range) {
  return r.preset ? `preset=${r.preset}` : `from=${isoDay(r.from)}&to=${isoDay(new Date(r.to.getTime() - DAY))}`;
}
