/** How to fix each failed SEO check (keyed by SeoCheck.id). Kept out of the stored rows so old scans get it too. */
export const SEO_CHECK_FIXES: Record<string, { fix: string; url?: string }> = {
  "http-status": {
    fix: "Make the page return HTTP 200. Redirect moved pages with a single 301 to their new URL, and remove links to pages that no longer exist.",
    url: "https://developers.google.com/search/docs/crawling-indexing/http-network-errors",
  },
  title: {
    fix: "Add a unique <title> of 10-60 characters that describes this page's content (e.g. \"Pricing - Product name\").",
    url: "https://developers.google.com/search/docs/appearance/title-link",
  },
  "meta-description": {
    fix: 'Add <meta name="description" content="..."> with a unique 50-160 character summary of this page.',
    url: "https://developers.google.com/search/docs/appearance/snippet",
  },
  h1: {
    fix: "Use exactly one <h1> for the page's main heading; turn any other <h1> elements into <h2>-<h6> that follow the outline.",
  },
  canonical: {
    fix: 'Add <link rel="canonical" href="https://..."> in <head>, pointing at the preferred absolute URL of this page.',
    url: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
  },
  lang: {
    fix: 'Set the page language on the root element, e.g. <html lang="en">.',
  },
  viewport: {
    fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> in <head>.',
    url: "https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing",
  },
  indexable: {
    fix: 'Remove "noindex" from <meta name="robots"> (and from any X-Robots-Tag header) if this page should appear in search results.',
    url: "https://developers.google.com/search/docs/crawling-indexing/block-indexing",
  },
  "img-alt": {
    fix: 'Add an alt attribute to every <img>: a short description for meaningful images, alt="" for decorative ones.',
    url: "https://developers.google.com/search/docs/appearance/google-images#use-descriptive-alt-text",
  },
};

/** One failing Lighthouse audit, trimmed from the full report (which is 1-3 MB per page). */
export interface LighthouseAudit {
  id: string;
  category: "performance" | "seo" | "best-practices";
  title: string;
  /** Lighthouse's own fix guidance, in Markdown with a "Learn more" link. */
  description: string;
  displayValue: string | null;
  score: number | null;
  savingsMs: number | null;
  savingsBytes: number | null;
  /** Up to a few of the audit's detail rows (URLs, wasted bytes, element selectors, ...). */
  items: Record<string, string | number>[];
}

/**
 * axe reports an element as a selector path: one entry per document (iframes), where an entry can itself
 * be a list of selectors through shadow roots. Joining it all with spaces produces a selector that
 * matches nothing, so keep the path and show it with ">>>" between documents and shadow roots.
 */
export function formatAxeTarget(target: readonly (string | readonly string[])[]): { target: string; targetPath: string[] } {
  const targetPath = target.map((t) => (typeof t === "string" ? t : t.join(" >>> ")));
  return { target: targetPath.join(" >>> "), targetPath };
}

/** Cuts text to max characters at the last line break (or space) before the limit, so instructions aren't split mid-sentence. */
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const line = cut.lastIndexOf("\n");
  const at = line > max / 2 ? line : cut.lastIndexOf(" ");
  return `${(at > max / 2 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

/**
 * Lighthouse descriptions are Markdown ending in a "[Learn how to ...](url)." link. Returns plain text
 * without that trailing link, plus the link itself, so each format can show it as a proper link or URL column.
 */
export function splitLinks(markdown: string): { text: string; url: string | null; label: string | null } {
  let url: string | null = null;
  let label: string | null = null;
  const trailing = /\s*\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)\.?\s*$/.exec(markdown);
  if (trailing) {
    label = trailing[1];
    url = trailing[2];
    markdown = markdown.slice(0, trailing.index);
  }
  const text = markdown
    .replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (_, inner: string, href: string) => {
      url ??= href;
      return inner;
    })
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return { text, url, label };
}
