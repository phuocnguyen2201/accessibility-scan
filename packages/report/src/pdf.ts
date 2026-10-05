import type { Browser, Page } from "playwright";

// Renders the self-contained report HTML (reportHtml, snapshotHtml) with a Playwright Chromium the caller
// owns. Shared by the worker (report emails) and the admin app (snapshot downloads).

type PdfOptions = NonNullable<Parameters<Page["pdf"]>[0]>;

/** A4 with page numbers: the full scan report. */
export const A4_REPORT: PdfOptions = {
  format: "A4",
  printBackground: true,
  margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" },
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate:
    '<div style="font-size:8px;color:#64748b;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
};

/** Fixed-size pages with no margins: page size comes from the HTML's @page rule (the snapshot slides). */
export const CSS_PAGES: PdfOptions = { printBackground: true, preferCSSPageSize: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } };

async function withPage<T>(browser: Browser, html: string, viewport: { width: number; height: number } | null, fn: (page: Page) => Promise<T>) {
  // The HTML is static and self-contained: no scripts, no network.
  const context = await browser.newContext({ javaScriptEnabled: false, ...(viewport ? { viewport } : {}) });
  try {
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    return await fn(page);
  } finally {
    await context.close().catch(() => {});
  }
}

export function renderPdf(browser: Browser, html: string, options: PdfOptions = A4_REPORT): Promise<Buffer> {
  return withPage(browser, html, null, (page) => page.pdf(options));
}

/** PNG of the first `height` pixels of the page (e.g. the snapshot's first slide). */
export function renderPng(browser: Browser, html: string, size: { width: number; height: number }): Promise<Buffer> {
  return withPage(browser, html, size, async (page) => {
    // Print-only layout rules (no margins/shadows) match the PDF.
    await page.emulateMedia({ media: "print" });
    return page.screenshot({ type: "png", clip: { x: 0, y: 0, ...size } });
  });
}
