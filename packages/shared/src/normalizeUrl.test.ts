import { describe, expect, it } from "vitest";
import { isCrawlable, normalizeUrl } from "./normalizeUrl";

describe("normalizeUrl", () => {
  it("treats www, case, trailing slash, hash and tracking params as the same page", () => {
    const a = normalizeUrl("https://www.Example.com/a/?utm_source=x#top");
    const b = normalizeUrl("example.com/a");
    expect(a?.key).toBe("example.com/a");
    expect(b?.key).toBe(a?.key);
  });

  it("ignores the scheme in the key but keeps it in the fetch url", () => {
    const a = normalizeUrl("http://example.com/");
    const b = normalizeUrl("https://example.com");
    expect(a?.key).toBe(b?.key);
    expect(a?.url).toBe("http://example.com");
    expect(b?.url).toBe("https://example.com");
  });

  it("defaults to https when no scheme is given", () => {
    expect(normalizeUrl("example.com")?.url).toBe("https://example.com");
  });

  it("sorts query params and drops default ports", () => {
    expect(normalizeUrl("https://example.com:443/p?b=2&a=1&gclid=z")?.key).toBe("example.com/p?a=1&b=2");
  });

  it("resolves relative links against a base", () => {
    expect(normalizeUrl("../c", "https://example.com/a/b/")?.url).toBe("https://example.com/a/c");
  });

  it("rejects non-http links", () => {
    expect(normalizeUrl("mailto:a@b.com")).toBeNull();
    expect(normalizeUrl("javascript:void(0)", "https://example.com")).toBeNull();
    expect(normalizeUrl("tel:123", "https://example.com")).toBeNull();
  });
});

describe("isCrawlable", () => {
  const link = (u: string) => normalizeUrl(u)!;
  it("keeps same-site html pages, including www vs apex", () => {
    expect(isCrawlable(link("https://www.example.com/about"), "example.com")).toBe(true);
  });
  it("skips other hosts, files and logout links", () => {
    expect(isCrawlable(link("https://other.com/"), "example.com")).toBe(false);
    expect(isCrawlable(link("https://example.com/file.pdf"), "example.com")).toBe(false);
    expect(isCrawlable(link("https://example.com/logout"), "example.com")).toBe(false);
  });
});
