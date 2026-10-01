export function scoreTone(score: number | null | undefined): "good" | "ok" | "bad" | "none" {
  if (score == null) return "none";
  if (score >= 90) return "good";
  if (score >= 50) return "ok";
  return "bad";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "-";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "-";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1000)} KB`;
}

export function formatDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "-";
  const secs = Math.round(((endIso ? new Date(endIso) : new Date()).getTime() - new Date(startIso).getTime()) / 1000);
  const m = Math.floor(secs / 60);
  return m ? `${m}m ${secs % 60}s` : `${secs}s`;
}

export function shortPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}
