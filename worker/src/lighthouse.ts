import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { chromium } from "playwright";
import { config, sleep } from "./config";
import { check, claimNextLighthouse, db, updatePage } from "./db";

const pct = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100));

/**
 * Runs forever: picks pages with lighthouse_status = 'queued' (scan samples and on-demand
 * requests from the detail page) and audits them one at a time on a dedicated Chrome.
 */
export async function lighthouseLoop(signal: AbortSignal) {
  let chrome: chromeLauncher.LaunchedChrome | null = null;

  const ensureChrome = async () => {
    if (!chrome) {
      chrome = await chromeLauncher.launch({
        chromePath: chromium.executablePath(),
        chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
      });
    }
    return chrome;
  };

  try {
    while (!signal.aborted) {
      const row = await claimNextLighthouse().catch((e) => {
        console.error("[lighthouse] claim failed:", e.message);
        return null;
      });
      if (!row) {
        await sleep(config.pollMs);
        continue;
      }

      console.log(`[lighthouse] ${row.url}`);
      try {
        const { port } = await ensureChrome();
        const result = await lighthouse(
          row.url,
          {
            port,
            output: "json",
            logLevel: "error",
            onlyCategories: ["performance", "accessibility", "seo", "best-practices"],
            maxWaitForLoad: config.pageTimeoutMs,
          },
          desktopConfig,
        );
        const lhr = result?.lhr;
        if (!lhr) throw new Error("Lighthouse returned no result");
        if (lhr.runtimeError) throw new Error(lhr.runtimeError.message);

        const audit = (id: string) => lhr.audits[id]?.numericValue ?? null;
        const performance = pct(lhr.categories.performance?.score);
        check(
          await db.from("lighthouse_results").upsert({
            page_id: row.id,
            performance,
            accessibility: pct(lhr.categories.accessibility?.score),
            seo: pct(lhr.categories.seo?.score),
            best_practices: pct(lhr.categories["best-practices"]?.score),
            lcp: audit("largest-contentful-paint"),
            fcp: audit("first-contentful-paint"),
            cls: audit("cumulative-layout-shift"),
            tbt: audit("total-blocking-time"),
            speed_index: audit("speed-index"),
            created_at: new Date().toISOString(),
          }),
          "upsert lighthouse",
        );
        await updatePage(row.id, {
          lighthouse_status: "done",
          ...(performance != null ? { perf_score: performance, perf_estimated: false } : {}),
        });
      } catch (err) {
        console.error(`[lighthouse] failed ${row.url}:`, err instanceof Error ? err.message : err);
        await updatePage(row.id, { lighthouse_status: "failed" }).catch(() => {});
        // A broken Chrome is the usual cause of repeated failures - start a fresh one next time.
        await (chrome as chromeLauncher.LaunchedChrome | null)?.kill();
        chrome = null;
      }
    }
  } finally {
    await (chrome as chromeLauncher.LaunchedChrome | null)?.kill();
  }
}
