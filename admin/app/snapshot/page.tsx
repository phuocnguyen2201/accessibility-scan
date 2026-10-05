import { Download } from "lucide-react";
import { SNAPSHOT_HEIGHT, SNAPSHOT_WIDTH, rangeLabel, snapshotHtml } from "@a11y/report";
import { RangePicker } from "@/components/RangePicker";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { parseRange, rangeQuery } from "@/lib/range";
import { loadStats, snapshotOptions } from "@/lib/stats";

export const dynamic = "force-dynamic";

// On screen the slides sit on a grey canvas with a 24px gap; preview at half size, up to phone width.
const SCALE = 0.5;
const PREVIEW_W = SNAPSHOT_WIDTH + 48;
const PREVIEW_H = SNAPSHOT_HEIGHT * 2 + 24 * 3;

/** Preview of the shareable two-slide snapshot, with PDF / PNG / HTML downloads. */
export default async function SnapshotPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const range = parseRange(await searchParams, "6m");
  const q = rangeQuery(range);
  const stats = await loadStats(range);
  const html = snapshotHtml(stats, snapshotOptions());

  const downloads = [
    ["PDF (LinkedIn document post)", "pdf"],
    ["PNG (first slide, image post)", "png"],
    ["HTML", "html"],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">LinkedIn snapshot</h1>
        <p className="text-sm text-slate-600">
          {rangeLabel(stats)} · two {SNAPSHOT_WIDTH}×{SNAPSHOT_HEIGHT} slides · statistics only
        </p>
      </div>
      <RangePicker range={range} path="/snapshot" />
      <div className="flex flex-wrap gap-2">
        {downloads.map(([label, format]) => (
          <a
            key={format}
            href={`/export?format=${format}&${q}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {label}
          </a>
        ))}
      </div>
      <Card title="Preview" hint="Growth compares the last two months of the range. Pick a range of 2+ months for the trend charts.">
        {/* Shown at half size. Sandboxed: the snapshot has no scripts and needs none. */}
        <div className="overflow-x-auto">
          <div className="mx-auto overflow-hidden rounded border border-slate-200" style={{ width: PREVIEW_W * SCALE, height: PREVIEW_H * SCALE }}>
            <iframe
              title="Snapshot preview"
              srcDoc={html}
              sandbox=""
              style={{ width: PREVIEW_W, height: PREVIEW_H, transform: `scale(${SCALE})`, transformOrigin: "0 0", border: 0 }}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
