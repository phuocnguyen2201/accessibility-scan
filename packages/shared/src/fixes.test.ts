import { describe, expect, it } from "vitest";
import { formatAxeTarget, SEO_CHECK_FIXES, splitLinks, truncateText } from "./fixes";
import { runSeoChecks } from "./scores";

describe("formatAxeTarget", () => {
  it("keeps a plain selector as is", () => {
    expect(formatAxeTarget(["#main > img"])).toEqual({ target: "#main > img", targetPath: ["#main > img"] });
  });
  it("marks iframe boundaries instead of joining selectors with a space", () => {
    expect(formatAxeTarget(["iframe#embed", "button.play"]).target).toBe("iframe#embed >>> button.play");
  });
  it("marks shadow-root boundaries", () => {
    const r = formatAxeTarget([["my-widget", "button"]]);
    expect(r.target).toBe("my-widget >>> button");
    expect(r.targetPath).toEqual(["my-widget >>> button"]);
  });
});

describe("truncateText", () => {
  it("leaves short text alone", () => {
    expect(truncateText("short", 10)).toBe("short");
  });
  it("cuts at a line break rather than mid-line", () => {
    const text = "Fix any of the following:\n  Element has insufficient color contrast of 2.8\n  Another very long instruction line here";
    expect(truncateText(text, 80)).toBe("Fix any of the following:\n  Element has insufficient color contrast of 2.8…");
  });
});

describe("SEO fixes", () => {
  it("has fix text for every SEO check", () => {
    const checks = runSeoChecks({
      httpStatus: 404,
      title: null,
      metaDescription: null,
      h1Count: 0,
      canonical: null,
      lang: null,
      viewport: null,
      robotsMeta: "noindex",
      imageCount: 1,
      imagesWithoutAlt: 1,
    });
    for (const c of checks) expect(SEO_CHECK_FIXES[c.id]?.fix, c.id).toBeTruthy();
  });
});

describe("splitLinks", () => {
  it("turns Lighthouse Markdown into text plus the first link", () => {
    expect(splitLinks("Reduce unused `JavaScript`. [Learn how](https://developer.chrome.com/docs/x).")).toEqual({
      text: "Reduce unused JavaScript.",
      url: "https://developer.chrome.com/docs/x",
      label: "Learn how",
    });
  });
  it("keeps links in the middle of the text as text", () => {
    expect(splitLinks("See [the guide](https://a.dev) first.")).toEqual({ text: "See the guide first.", url: "https://a.dev", label: null });
  });
});
