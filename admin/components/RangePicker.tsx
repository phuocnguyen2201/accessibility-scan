import Link from "next/link";
import { PRESETS, isoDay, type Preset, type Range } from "@/lib/range";
import { cx } from "./ui";

/** Preset links plus a custom from/to form (plain GET, no client JS). */
export function RangePicker({ range, path }: { range: Range; path: string }) {
  const lastDay = isoDay(new Date(range.to.getTime() - 86_400_000));
  return (
    <div className="flex flex-wrap items-end gap-3">
      <nav aria-label="Date range" className="flex flex-wrap gap-1">
        {(Object.keys(PRESETS) as Preset[]).map((p) => (
          <Link
            key={p}
            href={`${path}?preset=${p}`}
            aria-current={range.preset === p ? "true" : undefined}
            className={cx(
              "rounded-md px-2.5 py-1.5 text-sm",
              range.preset === p ? "bg-blue-700 font-medium text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
            )}
          >
            {PRESETS[p]}
          </Link>
        ))}
      </nav>
      <form action={path} className="flex flex-wrap items-end gap-2 text-sm">
        <label className="text-slate-700">
          From
          <input type="date" name="from" defaultValue={isoDay(range.from)} required className="ml-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900" />
        </label>
        <label className="text-slate-700">
          To
          <input type="date" name="to" defaultValue={lastDay} required className="ml-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900" />
        </label>
        <button type="submit" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-800 hover:bg-slate-50">
          Apply
        </button>
      </form>
    </div>
  );
}
