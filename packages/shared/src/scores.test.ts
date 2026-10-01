import { describe, expect, it } from "vitest";
import { computeA11yScore, computeSeoScore, estimatePerfScore, runSeoChecks } from "./scores";

describe("computeA11yScore", () => {
  it("is 100 with no violations", () => {
    expect(computeA11yScore(40, [])).toBe(100);
  });
  it("penalises critical issues more than minor ones", () => {
    expect(computeA11yScore(40, ["critical"])).toBeLessThan(computeA11yScore(40, ["minor"]));
  });
});

describe("SEO", () => {
  it("scores a well-formed page at 100", () => {
    const checks = runSeoChecks({
      httpStatus: 200,
      title: "A perfectly fine page title",
      metaDescription: "A meta description that is long enough to pass the fifty character check.",
      h1Count: 1,
      canonical: "https://example.com/",
      lang: "en",
      viewport: "width=device-width",
      robotsMeta: null,
      imageCount: 2,
      imagesWithoutAlt: 0,
    });
    expect(computeSeoScore(checks)).toBe(100);
  });
});

describe("estimatePerfScore", () => {
  it("rewards fast pages", () => {
    const fast = estimatePerfScore({ ttfb: 100, domContentLoaded: 500, load: 1000, transferSize: 200_000, requestCount: 20 });
    const slow = estimatePerfScore({ ttfb: 3000, domContentLoaded: 6000, load: 9000, transferSize: 8_000_000, requestCount: 300 });
    expect(fast).toBe(100);
    expect(slow).toBe(0);
  });
});
