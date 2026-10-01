import { XMLParser } from "fast-xml-parser";
import robotsParser from "robots-parser";
import { config } from "./config";

export type Robots = ReturnType<typeof robotsParser>;

const UA = `Mozilla/5.0 (compatible; ${config.userAgentSuffix})`;
const MAX_SITEMAP_FILES = 20;

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function loadRobots(origin: string): Promise<Robots> {
  const url = `${origin}/robots.txt`;
  return robotsParser(url, (await fetchText(url)) ?? "");
}

export function isAllowed(robots: Robots, url: string): boolean {
  return robots.isAllowed(url, config.userAgentSuffix) !== false;
}

const asArray = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Collects page URLs from the sitemaps listed in robots.txt, falling back to /sitemap.xml. */
export async function loadSitemapUrls(origin: string, robots: Robots, limit: number): Promise<string[]> {
  const parser = new XMLParser({ ignoreAttributes: true });
  const queue = robots.getSitemaps().length ? robots.getSitemaps() : [`${origin}/sitemap.xml`];
  const seen = new Set<string>();
  const urls: string[] = [];

  while (queue.length && seen.size < MAX_SITEMAP_FILES && urls.length < limit) {
    const sitemapUrl = queue.shift()!;
    if (seen.has(sitemapUrl)) continue;
    seen.add(sitemapUrl);

    const xml = await fetchText(sitemapUrl);
    if (!xml) continue;
    let doc: any;
    try {
      doc = parser.parse(xml);
    } catch {
      continue;
    }
    for (const s of asArray(doc?.sitemapindex?.sitemap)) if (s?.loc) queue.push(String(s.loc).trim());
    for (const u of asArray(doc?.urlset?.url)) {
      if (u?.loc) urls.push(String(u.loc).trim());
      if (urls.length >= limit) break;
    }
  }
  return urls;
}
