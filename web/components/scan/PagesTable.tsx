"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PageRow } from "@a11y/shared";
import { browserClient, selectAll } from "@/lib/supabase";
import { shortPath } from "@/lib/format";
import { Button, Card, ScoreBadge } from "../ui";

type SortKey = "url" | "depth" | "http_status" | "a11y_score" | "seo_score" | "perf_score" | "violation_count";
type Filter = "all" | "critical" | "errors" | "pending";

const COLUMNS = [
  "id, url, depth, crawl_status, http_status, title, a11y_score, seo_score, perf_score, perf_estimated,",
  "violation_count, critical_count, lighthouse_status, error, created_at",
].join(" ");
const PAGE_SIZE = 100;

const STATUS_TEXT: Record<PageRow["crawl_status"], string> = {
  pending: "Queued",
  scanning: "Scanning...",
  done: "Done",
  error: "Error",
  skipped: "Skipped",
};

export function PagesTable({ scanId, live }: { scanId: string; live: boolean }) {
  const [pages, setPages] = useState<Map<string, PageRow> | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "depth", asc: true });
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    const db = browserClient();
    selectAll<PageRow>((from, to) =>
      db.from("pages").select(COLUMNS).eq("scan_id", scanId).order("created_at").range(from, to) as never,
    ).then((rows) => setPages(new Map(rows.map((r) => [r.id, r]))));

    if (!live) return;
    const channel = db
      .channel(`pages-${scanId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pages", filter: `scan_id=eq.${scanId}` }, (payload) => {
        const row = payload.new as PageRow;
        if (!row?.id) return;
        setPages((prev) => new Map(prev ?? []).set(row.id, { ...prev?.get(row.id), ...row }));
      })
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [scanId, live]);

  const rows = useMemo(() => {
    if (!pages) return [];
    const q = query.trim().toLowerCase();
    const list = [...pages.values()].filter((p) => {
      if (q && !p.url.toLowerCase().includes(q) && !(p.title ?? "").toLowerCase().includes(q)) return false;
      if (filter === "critical") return p.critical_count > 0;
      if (filter === "errors") return p.crawl_status === "error" || (p.http_status ?? 200) >= 400;
      if (filter === "pending") return p.crawl_status === "pending" || p.crawl_status === "scanning";
      return true;
    });
    const dir = sort.asc ? 1 : -1;
    return list.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
  }, [pages, query, filter, sort]);

  const header = (key: SortKey, label: string, align = "text-left") => {
    const active = sort.key === key;
    return (
      <th scope="col" className={`px-3 py-2 font-medium ${align}`} aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-slate-900"
          onClick={() => setSort({ key, asc: active ? !sort.asc : key === "url" || key === "depth" })}
        >
          {label}
          <span aria-hidden="true">{active ? (sort.asc ? "▲" : "▼") : ""}</span>
        </button>
      </th>
    );
  };

  if (!pages) return <p className="text-slate-600">Loading pages...</p>;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <label htmlFor="page-search" className="block text-xs font-medium text-slate-700">
            Search
          </label>
          <input
            id="page-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="URL or title"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="page-filter" className="block text-xs font-medium text-slate-700">
            Show
          </label>
          <select
            id="page-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="all">All pages</option>
            <option value="critical">Has critical issues</option>
            <option value="errors">Errors / broken (4xx, 5xx)</option>
            <option value="pending">Not scanned yet</option>
          </select>
        </div>
        <p className="text-sm text-slate-600" aria-live="polite">
          {rows.length} of {pages.size} pages
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Pages found on this site. Column headers are sortable.</caption>
          <thead className="border-b border-slate-200 text-xs text-slate-600">
            <tr>
              {header("url", "Page")}
              {header("depth", "Depth", "text-right")}
              {header("http_status", "HTTP", "text-right")}
              {header("a11y_score", "A11y", "text-center")}
              {header("seo_score", "SEO", "text-center")}
              {header("perf_score", "Perf", "text-center")}
              {header("violation_count", "Issues", "text-right")}
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, limit).map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="max-w-md px-3 py-2">
                  {p.crawl_status === "done" || p.crawl_status === "error" ? (
                    <Link href={`/scans/${scanId}/pages/${p.id}`} className="block truncate font-medium text-blue-700 hover:underline" title={p.url}>
                      {shortPath(p.url)}
                    </Link>
                  ) : (
                    <span className="block truncate text-slate-800" title={p.url}>
                      {shortPath(p.url)}
                    </span>
                  )}
                  {p.title && <span className="block truncate text-xs text-slate-500">{p.title}</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{p.depth}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${(p.http_status ?? 0) >= 400 ? "font-semibold text-red-700" : ""}`}>
                  {p.http_status ?? "-"}
                </td>
                <td className="px-3 py-2 text-center">
                  <ScoreBadge score={p.a11y_score} label="Accessibility" />
                </td>
                <td className="px-3 py-2 text-center">
                  <ScoreBadge score={p.seo_score} label="SEO" />
                </td>
                <td className="px-3 py-2 text-center">
                  <ScoreBadge score={p.perf_score} estimated={p.perf_estimated} label="Performance" />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.violation_count}
                  {p.critical_count > 0 && <span className="ml-1 text-xs text-red-700">({p.critical_count} critical)</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600" title={p.error ?? undefined}>
                  {STATUS_TEXT[p.crawl_status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="mt-4 text-center">
          <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE * 5)}>
            Show more ({rows.length - limit} remaining)
          </Button>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">* Performance estimated from page timings; open a page to run Lighthouse.</p>
    </Card>
  );
}
