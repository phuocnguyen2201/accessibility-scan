const TRACKING_PARAM = /^(utm_.*|fbclid|gclid|dclid|msclkid|yclid|mc_cid|mc_eid|_ga|_gl|igshid|ref_src)$/i;

const NON_HTML_EXT =
  /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|mp4|webm|mov|avi|mkv|mp3|wav|ogg|zip|rar|7z|gz|tar|exe|dmg|msi|apk|docx?|xlsx?|pptx?|csv|txt|xml|json|rss|atom|css|js|woff2?|ttf|eot)$/i;

const UNSAFE_PATH = /(logout|log-out|signout|sign-out|\/wp-admin|\/cart\/(add|remove)|\/delete)/i;

export interface NormalizedUrl {
  /** Fetchable URL: scheme kept, host lowercased, junk removed. */
  url: string;
  /** Dedupe key: no scheme, no `www.`, no trailing slash. Equal keys = same page. */
  key: string;
  /** Hostname without `www.` - used to decide whether a link stays on the same site. */
  host: string;
}

/**
 * Normalizes user input or a discovered link.
 * Returns null for anything that is not an http(s) URL.
 */
export function normalizeUrl(input: string, base?: string): NormalizedUrl | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!base && !/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = `https://${raw.replace(/^\/+/, "")}`;

  let u: URL;
  try {
    u = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname) return null;

  u.hash = "";
  u.username = "";
  u.password = "";
  u.hostname = u.hostname.toLowerCase().replace(/\.$/, "");
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) {
    u.port = "";
  }

  const params = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAM.test(k))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  u.search = "";
  for (const [k, v] of params) u.searchParams.append(k, v);

  let path = u.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  u.pathname = path;

  const host = u.hostname.replace(/^www\./, "");
  const port = u.port ? `:${u.port}` : "";
  const keyPath = path === "/" ? "" : path;
  const url = u.toString();
  return {
    url: path === "/" && !u.search ? url.replace(/\/$/, "") : url,
    key: `${host}${port}${keyPath}${u.search}`,
    host,
  };
}

/** True when the link points at an HTML-ish page on the same site (www and apex count as the same). */
export function isCrawlable(link: NormalizedUrl, siteHost: string): boolean {
  if (link.host !== siteHost) return false;
  const path = new URL(link.url).pathname;
  if (NON_HTML_EXT.test(path)) return false;
  if (UNSAFE_PATH.test(path)) return false;
  return true;
}
