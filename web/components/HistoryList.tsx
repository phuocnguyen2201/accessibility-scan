"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Scan } from "@a11y/shared";
import { browserClient } from "@/lib/supabase";
import { formatDate } from "@/lib/format";
import { ScanRowMenu } from "./ScanRowMenu";
import { Card, ScoreBadge, StatusBadge } from "./ui";

type HistoryRow = Scan & { site: { display_url: string; normalized_url: string } };

export function HistoryList() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const db = browserClient();
    const load = async () => {
      const { data } = await db
        .from("scans")
        .select("*, site:sites!scans_site_id_fkey(display_url, normalized_url)")
        .order("created_at", { ascending: false })
        .limit(100);
      setRows((data as HistoryRow[]) ?? []);
    };
    load();
    // Running scans update their counters after every page; reload at most every 2s.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = db
      .channel("history")
      .on("postgres_changes", { event: "*", schema: "public", table: "scans" }, () => {
        timer ??= setTimeout(() => {
          timer = null;
          load();
        }, 2000);
      })
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      db.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows?.filter((r) => r.site.normalized_url.includes(q)) : rows;
  }, [rows, query]);

  return (
    <Card title="Scan history">
      <label htmlFor="history-search" className="sr-only">
        Search history
      </label>
      <input
        id="history-search"
        type="search"
        placeholder="Search sites..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm"
      />
      {filtered == null ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-600">No scans yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((s) => (
            <li key={s.id} className="flex items-center gap-1">
              <Link href={`/scans/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded px-2 py-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900">{s.site.normalized_url}</div>
                  <div className="text-xs text-slate-600">
                    {formatDate(s.created_at)} · {s.status === "completed" ? s.summary?.total_pages ?? s.pages_found : `${s.pages_scanned}/${s.pages_found}`} pages
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <ScoreBadge score={s.summary?.avg_a11y} label="Accessibility" />
                  <StatusBadge status={s.status} />
                </div>
              </Link>
              <ScanRowMenu
                scanId={s.id}
                siteLabel={s.site.normalized_url}
                createdAt={s.created_at}
                status={s.status}
                onDeleted={(id) => setRows((prev) => prev?.filter((r) => r.id !== id) ?? null)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
