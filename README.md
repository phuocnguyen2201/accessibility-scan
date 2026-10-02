# A11y Site Scanner

Crawls every internal page of a website and audits each page for **accessibility** (axe-core), **SEO** (on-page checks) and **performance** (page timings on every page, plus Lighthouse on a sample). Results are stored per account and update live while the scan runs.

**Try it live:** https://accessibility-scan.netlify.app — sign up with your email, verify it, and start a scan.

```
Browser ──► Next.js (web/) ──► Supabase (Postgres + Realtime)
                                  ▲
                 worker/ (Node) ──┘  claims queued scans, crawls with
                 Playwright + @axe-core/playwright + Lighthouse
```

| Folder | What it is |
|---|---|
| `web/` | Next.js UI: scan form + history, scan dashboard, pages table, page detail, auth pages |
| `worker/` | Long-running scanner service and CLI |
| `packages/shared/` | URL normalization, score formulas, shared types |
| `supabase/` | Schema, RLS policies, queue / stats RPCs, auth email templates |

## Features

### Site crawling

- **Whole-site crawl**: breadth-first, seeded from `sitemap.xml`, respects `robots.txt`.
- **Stays on the site**: same host only (`www` and the bare domain count as one), skips files and logout links, never exceeds the page limit.
- **Configurable per scan**: max pages and Lighthouse sample size under *Advanced options*.
- **Resumable**: workers send heartbeats. If one dies, another worker (or the same one after a restart) picks the scan up 2 minutes later and continues where it stopped.
- **Cancellable**: *Cancel scan* stops after the pages currently in progress; the summary is still computed.
- **Live progress**: the UI subscribes to Supabase Realtime, so counts and scores update as pages finish.

### Duplicate detection

URLs are normalized before lookup: scheme, `www.`, letter case, trailing slash and `#hash` are ignored, tracking params (`utm_*`, `gclid`, …) are dropped and the rest are sorted. So `https://www.Example.com/?utm_source=x` and `example.com` are the same site.

Submitting a site you already scanned offers **View results** or **Re-scan**. A re-scan adds a new entry to that site's history.

### Accessibility audit

- axe-core runs on **every** page against WCAG 2.0 / 2.1 A + AA, WCAG 2.2 AA and best-practice rules.
- Each issue shows its impact, WCAG tags, a description and a **How to fix** link to Deque University.
- Affected elements (up to 25 per rule per page) can be stepped through with **Previous / Next**, each with its HTML snippet and the reasons it failed.

### SEO checks

Nine on-page checks per page: HTTP 200, title length, meta description, exactly one `<h1>`, canonical link, `lang` attribute, viewport meta, no `noindex`, and image `alt` attributes. The Lighthouse SEO score is shown alongside when available.

### Performance

- **Every page**: TTFB, DOMContentLoaded, load time, total transfer size and request count.
- **Lighthouse (desktop)**: runs on the shallowest N pages of each scan (default 50). Any other page can be audited on demand with **Run Lighthouse** on its detail page.

### Scores

| Score | How it is computed |
|---|---|
| Accessibility | axe results weighted by impact (critical 10, serious 7, moderate 3, minor 1): `passed / (passed + violated) × 100`, where each passed rule counts as weight 3 |
| SEO | % of the 9 on-page checks passed |
| Performance | Lighthouse score where it ran. Otherwise estimated from TTFB, load time, page weight and request count, marked with `*` in the UI |

### Scan dashboard

- **Overview**: total / scanned / errored pages and average accessibility, SEO and performance scores.
- **Most common accessibility issues** across the site.
- **Issues by impact** breakdown (critical, serious, moderate, minor).
- **Pages needing the most work**, linked to their detail pages.

### Pages table

- **Search** by URL.
- **Filter**: all pages, has critical issues, errors / broken (4xx, 5xx), not scanned yet.
- **Sort** by depth, accessibility, issue count, SEO, performance, HTTP status or URL.
- Works as a table on desktop and as cards on mobile.

### False positives

Each accessibility issue on a page has a **False positive** button.

- **Scope**: only this page, or every page on the site (useful for a shared header or widget). An optional reason can be added.
- **Effect**: the issue moves to a *Marked as false positive* section with a **Restore** button, and is excluded from the page score, issue counts, dashboard averages and charts.
- **Persistent**: markings are stored per site, so they apply automatically to future re-scans.

### History

The home page lists your previous scans. Each row opens that scan's results, and its menu can delete the scan (a running scan must be cancelled first).

### Accounts

- Email + password sign-up with **email verification**, resend-verification and **password reset** flows.
- Every page except the auth pages requires sign-in; you're returned to the original page afterwards.
- **Results are private**: users only see their own sites and scans, enforced by database RLS, not just the UI. Duplicate detection is per account, so two users can each scan `example.com`.

### CLI

Queue and run a scan without the UI. The scan is saved to the given account's history:

```bash
npm run scan -- https://example.com --email you@example.com --max 50 --lighthouse 5
```

### Security

- The browser only gets the anon key plus the user's session. All writes go through server actions (which verify ownership) or the worker.
- The worker refuses to scan hosts that resolve to private / internal IPs (`BLOCK_PRIVATE_IPS`, on by default).

## Scale and tuning

- axe takes about 2–4 s per page with `WORKER_CONCURRENCY` tabs (default 4), so **800 pages take roughly 10–15 min**.
- Lighthouse takes 11–15 s per page and runs one page at a time, which is why it's sampled (`DEFAULT_LIGHTHOUSE_SAMPLE`).
- Page limit defaults to 800; raise it with `MAX_PAGES_CAP` (e.g. `1200`).
- Storage stays small: at most 25 example elements per rule per page, and full Lighthouse reports aren't stored.
- Each worker runs one scan at a time; run more workers to scan sites in parallel. `LIGHTHOUSE_ENABLED` lets you restrict Lighthouse to one worker on a small host.

## Tests

```bash
npm test           # URL normalization + scoring unit tests
npm run typecheck
```
