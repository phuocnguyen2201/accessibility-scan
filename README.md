# A11y Site Scanner

Scan a whole website for **accessibility**, **SEO**, **performance** and **best-practice** problems, page by page, and see exactly what to fix.

**Try it live:** https://accessibility-scan.netlify.app — sign up with your email (or continue as a guest) and start a scan.

## Scanning a site

- **Whole-site scan**: enter one URL and the scanner finds every page of the site through its links and sitemap. It respects `robots.txt`.
- **Stays on your site**: only pages on the same domain are scanned (`www` and the bare domain count as one site). Files and logout links are skipped.
- **Choose what to check**: tick any of Accessibility, SEO, Performance and Best practices. Only the checks you pick are run and shown in the results.
- **Advanced options**: set the maximum number of pages (up to 800 by default) and how many pages get an in-depth Lighthouse audit.
- **Live progress**: scores and counts update as each page finishes. You can leave the page and come back.
- **Cancel any time**: stopping a scan keeps the results for the pages already checked.
- **Re-scan**: run the same site again with the same settings. If you enter a site you've already scanned, you're offered to view the last results or scan again. Different spellings of the same address (`https://www.Example.com/?utm_source=x` and `example.com`) are recognized as the same site.

## What gets checked

### Accessibility

- Every page is checked against **WCAG 2.0, 2.1 and 2.2 (levels A and AA)** plus accessibility best practices.
- Each issue shows how serious it is (critical, serious, moderate, minor), the WCAG rules it relates to, a plain description and a **How to fix** link.
- Step through the affected elements one by one with **Previous / Next**, each with its HTML and the reason it failed.

### SEO

Nine on-page checks on every page:

- Page loads successfully (HTTP 200)
- Title is 10–60 characters
- Meta description is 50–160 characters
- Exactly one main heading (`<h1>`)
- Canonical link is set
- Page language is declared
- Mobile viewport is set
- Page isn't hidden from search engines (no `noindex`)
- Images have `alt` text

### Performance

- **Every page**: time to first byte, page load times, total download size and number of requests.
- **Lighthouse audit** on a sample of pages: Largest Contentful Paint, First Contentful Paint, Total Blocking Time, Cumulative Layout Shift and Speed Index.
- Run Lighthouse on **any other page** with one click from its detail page.

### Best practices

The Lighthouse best-practices score, shown for pages that get a Lighthouse audit.

## Scores

Each page gets a 0–100 score per category, and the dashboard shows the site-wide average.

| Score | What it means |
|---|---|
| Accessibility | Based on how many accessibility rules pass and fail, with serious problems weighing more |
| SEO | Share of the nine SEO checks that pass |
| Performance | The Lighthouse score where it ran; otherwise an estimate from page timings, marked with `*` |
| Best practices | The Lighthouse best-practices score |

## Reading the results

### Dashboard

- Total pages found, scanned and with errors.
- Average score for each category you checked.
- **Most common accessibility issues** across the site, with how many pages each affects.
- **Issues by severity** breakdown.
- **Pages needing the most work**, each linking to its details.

### Pages list

- **Search** by URL or page title.
- **Filter** to pages with critical issues, broken pages (4xx / 5xx errors) or pages not scanned yet.
- **Sort** by any score, issue count, HTTP status, depth or URL.
- Works as a table on desktop and as cards on mobile.

### Page details

Every score, accessibility issue, SEO check and performance metric for a single page, plus the **Run Lighthouse** button.

## False positives

Think an accessibility issue is wrong? Mark it as a **False positive**:

- Hide it on **just this page** or on **every page of the site** (handy for a shared header or widget), with an optional note.
- It's removed from scores, counts and charts, and listed separately with a **Restore** button.
- Your markings are remembered for the site, so future re-scans respect them too.

## History

Your home page lists every scan you've run. Open any of them to see its results, or delete scans you no longer need.

## Accounts and privacy

- Sign up with email and password, with email verification and password reset.
- **Guest mode**: try it without an account. Guests can run one scan per hour, on up to 100 pages with Lighthouse on 5 of them.
- **Your results are private**: only you can see your sites and scans.
- Scans are limited to public websites; private or internal network addresses are refused.
