import { hostname } from "node:os";
import { chromium, type Browser } from "playwright";
import { config, sleep } from "./config";
import { finalizeScan, runScan } from "./crawler";
import { claimNextScan } from "./db";
import { lighthouseLoop } from "./lighthouse";

const workerId = `${hostname()}-${process.pid}`;
const controller = new AbortController();

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    if (controller.signal.aborted) process.exit(1);
    console.log(`\n${sig} received, finishing current work (press again to force quit)...`);
    controller.abort();
  });
}

/**
 * Picks up queued scans one at a time. `onlyScanId` is used by the CLI to stop after a given scan.
 */
export async function scanLoop(signal: AbortSignal, onlyScanId?: string) {
  let browser: Browser | null = null;
  try {
    while (!signal.aborted) {
      const scan = await claimNextScan(workerId).catch((e) => {
        console.error("claim_next_scan failed:", e.message);
        return null;
      });
      if (!scan) {
        await sleep(config.pollMs);
        continue;
      }

      if (!browser?.isConnected()) browser = await chromium.launch({ headless: true });
      try {
        await runScan(scan, browser);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scan ${scan.id.slice(0, 8)}] failed:`, message);
        await finalizeScan(scan.id, scan.site_id, "failed", message).catch(() => {});
      }
      if (onlyScanId && scan.id === onlyScanId) return;
    }
  } finally {
    await browser?.close().catch(() => {});
  }
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("/src/index.ts");
if (isMain) {
  console.log(`worker ${workerId} started (concurrency ${config.concurrency}, lighthouse ${config.lighthouseEnabled ? "on" : "off"})`);
  await Promise.all([scanLoop(controller.signal), config.lighthouseEnabled ? lighthouseLoop(controller.signal) : null]);
  console.log("worker stopped");
  process.exit(0);
}
