import "server-only";
import { chromium, type Browser } from "playwright";

// One Chromium for PDF / PNG exports, launched on first use and closed after 2 idle minutes so it doesn't
// hold memory on the Pi next to the scanner workers.

const IDLE_MS = 2 * 60_000;
let browser: Promise<Browser> | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let active = 0;

export async function withBrowser<T>(fn: (b: Browser) => Promise<T>): Promise<T> {
  if (idleTimer) clearTimeout(idleTimer);
  browser ??= chromium.launch({ args: ["--disable-dev-shm-usage"] }).catch((err) => {
    browser = null;
    throw err;
  });
  active++;
  try {
    return await fn(await browser);
  } finally {
    active--;
    if (active === 0) {
      idleTimer = setTimeout(async () => {
        const b = browser;
        browser = null;
        await (await b)?.close().catch(() => {});
      }, IDLE_MS);
    }
  }
}
