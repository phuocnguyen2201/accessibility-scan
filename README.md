# A11y Site Scanner

Crawls every internal page of a website and audits each page for **accessibility** (axe-core), **SEO** (on-page checks) and **performance** (page timings for every page, plus Lighthouse on a sample of pages). Results are stored in **Supabase**.

```
Browser ──► Next.js (web/) ──► Supabase (Postgres + Realtime)
                                  ▲
                 worker/ (Node) ──┘  claims queued scans, crawls with
                 Playwright + @axe-core/playwright + Lighthouse
```

| Folder | What it is |
|---|---|
| `web/` | Next.js UI: landing page + history, scan overview/dashboard, pages table, page detail |
| `worker/` | Long-running scanner service (can't run on serverless; long scans exceed function timeouts) |
| `packages/shared/` | URL normalization (duplicate detection), score formulas, shared types |
| `supabase/migrations/` | Schema, RLS, queue / stats RPCs |

## Setup

1. **Create a Supabase project** (or run `npx supabase start` locally with Docker).
2. **Apply the schema**: run all files in `supabase/migrations/` in filename order (paste them into the SQL editor), or run `npx supabase db push`.
3. **Set up auth and email verification**. See [Accounts and email verification](#accounts-and-email-verification) below.
4. **Configure env**: `cp .env.example .env` and fill in the URL, anon key and service-role key (Settings → API), and set `SITE_URL`.
5. **Install** (this also downloads Playwright Chromium):
   ```bash
   npm install
   ```
6. **Run** the web app and the worker in two terminals:
   ```bash
   npm run dev:web      # http://localhost:3000
   npm run dev:worker
   ```

## Deployment: Netlify (web) + Raspberry Pi (workers)

**Web app on Netlify.** Import the repo and configure the site:

1. **Build settings:** leave **Base directory** empty (repo root). Set **Package directory** to `web`. The build command and publish directory come from `web/netlify.toml`.
2. **Environment variables:** add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (mark it secret), `SITE_URL=https://<your-site>.netlify.app`, `MAX_PAGES_CAP`, `DEFAULT_MAX_PAGES` and `DEFAULT_LIGHTHOUSE_SAMPLE`.
3. **Deploy from this PC:** run `npm run deploy:netlify`, or add `-- --draft` to get a preview URL first. It builds inside a Linux Docker container, so Docker Desktop must be running and you need to have run `netlify login` once. A plain `netlify deploy --build` on Windows fails while bundling `proxy.ts`: Netlify's Next.js adapter mangles Windows paths.
4. **Supabase:** under Authentication → URL Configuration, set **Site URL** to the Netlify URL. Add `https://<your-site>.netlify.app/**` to **Redirect URLs**, so verification and reset emails link to the live site.

**Workers on the Pi** (64-bit OS, Docker installed). Copy `.env` to the Pi, then:

```bash
docker compose up -d --build     # starts worker-1 and worker-2
docker compose logs -f           # watch scans
```

- `worker-1` and `worker-2` each use 2 browser tabs, so two different scans run in parallel.
- Only `worker-1` runs Lighthouse (`LIGHTHOUSE_ENABLED`). If it is stopped, scans wait in the "Running Lighthouse" phase until it is back.
- Each worker is limited to 3 GB of RAM.
- The workers only connect *out* to Supabase, so no port forwarding is needed.
- To also run the web app on the Pi instead of Netlify: `docker compose --profile web up -d --build`.

Quick CLI scan (no UI needed). The scan is saved to that account's history: `npm run scan -- https://example.com --email you@example.com --max 50 --lighthouse 5`

## Accounts and email verification

Users sign up with email + password and must verify their email before they can sign in. Every site and scan belongs to the account that created it. **Users only ever see their own results**; database RLS policies enforce this, not just the UI. Duplicate detection is per account, so two users can each scan `example.com`.

**Hosted Supabase**, in the dashboard:

1. **Authentication → Sign In / Providers → Email**: turn on **Confirm email** (on by default). Set the minimum password length to 8.
2. **Authentication → URL Configuration**: set **Site URL** to your app URL (e.g. `http://localhost:3000`). Add `http://localhost:3000/**` (and your production URL with `/**`) to **Redirect URLs**.
3. **Authentication → Emails → Templates**: paste the body of `supabase/templates/confirmation.html` into *Confirm signup* and `supabase/templates/recovery.html` into *Reset password*. These links use a `token_hash`, so they still work when opened in a different browser or on a phone. The default templates also work, but only in the browser that signed up.
4. **Production email**: Supabase's built-in mailer only allows a few emails per hour. Configure custom SMTP (Resend, SendGrid, Postmark, …) under **Authentication → Emails → SMTP Settings** before real users sign up.

**Local Supabase** (`npx supabase start`): `supabase/config.toml` already enables confirmations and the templates. No real emails are sent. Open the Mailpit inbox at http://127.0.0.1:54324 to click the verification link.

Flows:

- **Sign up**: a verification email is sent, and its link goes to `/auth/confirm`, which signs the user in.
- **Signing in before verifying**: shows an error with a **Resend verification email** button.
- **Forgot password**: the reset email links to `/auth/confirm`, which leads to `/auth/update-password`.
- **All other pages** require a signed-in user. `proxy.ts` redirects to `/login` and returns the user to the original page after sign-in.

## How it works

- **Duplicate detection**: URLs are normalized before lookup:
  - the scheme, `www.`, letter case, trailing slash and `#hash` are ignored
  - tracking params (`utm_*`, `gclid`, …) are removed and the rest are sorted

  So `https://www.Example.com/?utm_source=x` and `example.com` are the same site. Submitting a site that was already scanned shows *View results* / *Re-scan*. A re-scan adds a new scan to that site's history.
- **Crawl queue**: the `pages` table *is* the crawl queue.
  - The worker claims pages atomically (`FOR UPDATE SKIP LOCKED`). The crawl goes breadth-first, seeded from `sitemap.xml`, and respects `robots.txt`.
  - It stays on the same host (www and the bare domain count as one host) and skips files and logout links.
  - It never goes over `max_pages`.
- **Resume**: the worker sends a heartbeat. If it dies, another worker (or the same one after a restart) takes over the scan **2 minutes** later and continues from where it stopped.
- **Cancel**: the *Cancel scan* button stops the crawl after the pages currently being scanned. The summary is still computed.
- **Live progress**: the UI subscribes to Supabase Realtime on `scans` and `pages`.

### Scores

| Score | How it is computed |
|---|---|
| Accessibility | axe results weighted by impact (critical 10, serious 7, moderate 3, minor 1): `passed / (passed + violated) × 100`, where each passed rule counts as weight 3 |
| SEO | % of 9 on-page checks passed: HTTP 200, title length, meta description, one `<h1>`, canonical, `lang`, viewport, no `noindex`, image alt. The Lighthouse SEO score is shown next to it when available |
| Performance | Lighthouse (desktop) score where Lighthouse ran. Otherwise estimated from TTFB, load time, page weight and request count, marked with `*` in the UI |

### False positives

Each accessibility issue on a page's detail view has a **False positive** button.
- **Scope**: the marking applies either to *only this page* or to *every page on this site* (handy for a shared header or widget). An optional reason can be added.
- **Effect**: marked issues move to a "Marked as false positive" section with a **Restore** button. They're excluded from the page's accessibility score, its issue counts, the dashboard averages, the most-common-issues chart and the impact breakdown.
- **Re-scans**: markings are stored per site (`dismissals` table), so they're applied automatically to re-scans of that site.

### Large sites (800 → 1200 pages)

- axe runs on **every** page, with `WORKER_CONCURRENCY` tabs (default 4). That's about 2–4 s per page, so **800 pages take roughly 10–15 min**.
- Lighthouse takes about 11–15 s per page and must run one page at a time, so it only runs on the **shallowest N pages** (`DEFAULT_LIGHTHOUSE_SAMPLE`, default 50). Any other page can be audited on demand with **Run Lighthouse** on its detail page.
- To raise the page limit to 1200, set `MAX_PAGES_CAP=1200`. No code change is needed.
- Storage stays small: each violation keeps at most 5 example elements, and full Lighthouse reports are not stored.
- More throughput: increase `WORKER_CONCURRENCY` (needs CPU/RAM), or run more workers (`docker-compose.yml` defines two). Each worker runs one scan at a time, so separate scans run in parallel. On a small host, enable `LIGHTHOUSE_ENABLED` on only one worker.

## Security notes

- The browser only ever gets the **anon** key plus the user's session.
  - RLS lets a signed-in user read only their own sites, scans, pages, violations and Lighthouse results, and nobody can write directly.
  - All writes go through Next.js server actions, which check the signed-in user and their ownership first, or through the worker. Both use the service-role key server-side.
- The worker refuses to scan hosts that resolve to private/internal IPs (`BLOCK_PRIVATE_IPS=true`). Keep this on if the app is reachable by others.
- Scans created before the auth migration have no owner and are hidden from everyone.

## Tests

```bash
npm test           # URL normalization + scoring unit tests
npm run typecheck
```
