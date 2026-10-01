import type { Browser, BrowserContext, Page } from "playwright";
import { isCrawlable, normalizeUrl, type NormalizedUrl, type PageRow, type Scan } from "@a11y/shared";
import { config, sleep } from "./config";
import { check, claimNextPage, db, enqueuePages, touchScan, updatePage, updateScan } from "./db";
import { isAllowed, loadRobots, loadSitemapUrls, type Robots } from "./discover";
import { scanPage } from "./scanPage";
import { assertPublicHost } from "./ssrf";

const log = (scan: Scan, msg: string) => console.log(`[scan ${scan.id.slice(0, 8)}] ${msg}`);

interface CrawlContext {
  scan: Scan;
  siteHost: string;
  robots: Robots;
}

function crawlableLinks(ctx: CrawlContext, hrefs: string[]): NormalizedUrl[] {
  const out: NormalizedUrl[] = [];
  for (const href of hrefs) {
    const link = normalizeUrl(href);
    if (link && isCrawlable(link, ctx.siteHost) && isAllowed(ctx.robots, link.url)) out.push(link);
  }
  return out;
}

async function enqueueChunked(scanId: string, parentId: string | null, depth: number, links: NormalizedUrl[]) {
  for (let i = 0; i < links.length; i += 500) {
    const chunk = links.slice(i, i + 500).map(({ url, key }) => ({ url, key }));
    if ((await enqueuePages(scanId, parentId, depth, chunk)) === 0 && i > 0) break; // scan is full
  }
}

async function processPage(ctx: CrawlContext, row: PageRow, page: Page) {
  const now = () => new Date().toISOString();
  try {
    if (!isAllowed(ctx.robots, row.url)) {
      await updatePage(row.id, { crawl_status: "skipped", error: "Blocked by robots.txt", scanned_at: now() });
      return;
    }

    const result = await scanPage(page, row.url);

    if (result.kind !== "done") {
      await updatePage(row.id, {
        crawl_status: result.kind === "http-error" ? "error" : "skipped",
        http_status: result.httpStatus,
        content_type: result.contentType,
        error: result.reason,
        scanned_at: now(),
      });
      return;
    }

    const final = normalizeUrl(result.finalUrl);
    if (final && final.host !== ctx.siteHost) {
      await updatePage(row.id, {
        crawl_status: "skipped",
        http_status: result.httpStatus,
        error: `Redirected off-site to ${result.finalUrl}`,
        scanned_at: now(),
      });
      return;
    }

    // Retries must not duplicate violations.
    check(await db.from("violations").delete().eq("page_id", row.id), "clear violations");
    if (result.violations.length) {
      check(
        await db.from("violations").insert(result.violations.map((v) => ({ ...v, page_id: row.id, scan_id: ctx.scan.id }))),
        "insert violations",
      );
    }

    await updatePage(row.id, {
      crawl_status: "done",
      http_status: result.httpStatus,
      content_type: result.contentType,
      title: result.title,
      a11y_score: result.a11yScore,
      a11y_passes: result.a11yPasses,
      seo_score: result.seoScore,
      perf_score: result.perfScore,
      perf_estimated: true,
      violation_count: result.violations.reduce((s, v) => s + v.node_count, 0),
      critical_count: result.violations.filter((v) => v.impact === "critical").reduce((s, v) => s + v.node_count, 0),
      perf_metrics: result.perfMetrics,
      seo_checks: result.seoChecks,
      error: null,
      scanned_at: now(),
    });
    // Hide issues the user already marked as false positives on this site (recomputes counts + score).
    check(await db.rpc("apply_dismissals", { p_page_ids: [row.id] }), "apply dismissals");

    await enqueueChunked(ctx.scan.id, row.id, row.depth + 1, crawlableLinks(ctx, result.links));
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
    const retry = row.attempts < config.maxAttempts;
    await updatePage(row.id, {
      crawl_status: retry ? "pending" : "error",
      error: message.slice(0, 1000),
      scanned_at: retry ? null : now(),
    }).catch(() => {});
  }
}

async function crawl(ctx: CrawlContext, context: BrowserContext): Promise<"done" | "cancelled"> {
  let active = 0;
  let cancelled = false;

  const tab = async () => {
    let page = await context.newPage();
    let idleChecks = 0;
    try {
      while (!cancelled) {
        const row = await claimNextPage(ctx.scan.id);
        if (!row) {
          // Another tab may still be scanning a page that will enqueue new links.
          if (active === 0 && ++idleChecks >= 3) return;
          await sleep(1000);
          continue;
        }
        idleChecks = 0;
        active++;
        try {
          if (page.isClosed()) page = await context.newPage();
          await processPage(ctx, row, page);
        } finally {
          active--;
        }
        if ((await touchScan(ctx.scan.id)) === "cancelled") cancelled = true;
        await sleep(config.requestDelayMs);
      }
    } finally {
      await page.close().catch(() => {});
    }
  };

  await Promise.all(Array.from({ length: config.concurrency }, tab));
  return cancelled ? "cancelled" : "done";
}

async function waitForLighthouse(scan: Scan): Promise<"done" | "cancelled"> {
  for (;;) {
    const { count, error } = await db
      .from("pages")
      .select("id", { count: "exact", head: true })
      .eq("scan_id", scan.id)
      .in("lighthouse_status", ["queued", "running"]);
    if (error) throw new Error(error.message);
    if (!count) return "done";
    if ((await touchScan(scan.id)) === "cancelled") {
      await db.from("pages").update({ lighthouse_status: "none" }).eq("scan_id", scan.id).eq("lighthouse_status", "queued");
      return "cancelled";
    }
    await sleep(3000);
  }
}

export async function finalizeScan(scanId: string, siteId: string, status: "completed" | "cancelled" | "failed", error?: string) {
  await updateScan(scanId, { phase: "finalizing" });
  await touchScan(scanId);
  const { data: summary } = await db.rpc("scan_stats", { p_scan_id: scanId });
  await updateScan(scanId, {
    status,
    phase: null,
    finished_at: new Date().toISOString(),
    summary: summary ?? null,
    ...(error ? { error } : {}),
  });
  await db.from("sites").update({ last_scan_id: scanId }).eq("id", siteId);
}

export async function runScan(scan: Scan, browser: Browser) {
  const start = normalizeUrl(scan.start_url);
  if (!start) throw new Error(`Invalid start URL: ${scan.start_url}`);
  const startUrl = new URL(start.url);
  if (config.blockPrivateIps) await assertPublicHost(startUrl.hostname);

  log(scan, `starting ${start.url} (max ${scan.max_pages} pages, lighthouse sample ${scan.lighthouse_sample})`);
  await updateScan(scan.id, { phase: "crawling" });

  const robots = await loadRobots(startUrl.origin);
  const ctx: CrawlContext = { scan, siteHost: start.host, robots };

  // Seeding is idempotent (unique per scan), so a resumed scan just skips this.
  await enqueuePages(scan.id, null, 0, [{ url: start.url, key: start.key }]);
  const sitemapLinks = crawlableLinks(ctx, await loadSitemapUrls(startUrl.origin, robots, scan.max_pages));
  if (sitemapLinks.length) log(scan, `seeded ${sitemapLinks.length} URLs from sitemap`);
  await enqueueChunked(scan.id, null, 1, sitemapLinks);

  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 900 } });
  let outcome: "done" | "cancelled";
  try {
    outcome = await crawl(ctx, context);
  } finally {
    await context.close().catch(() => {});
  }

  if (outcome === "done" && scan.lighthouse_sample > 0) {
    await updateScan(scan.id, { phase: "lighthouse" });
    const { data: queued } = await db.rpc("queue_lighthouse_sample", { p_scan_id: scan.id, p_limit: scan.lighthouse_sample });
    log(scan, `crawl finished, running Lighthouse on ${queued ?? 0} pages`);
    outcome = await waitForLighthouse(scan);
  }

  await finalizeScan(scan.id, scan.site_id, outcome === "cancelled" ? "cancelled" : "completed");
  log(scan, outcome === "cancelled" ? "cancelled" : "completed");
}
