// Detects the built-in browsers that social / chat apps open links in. Those webviews often break
// sign-in cookies, file downloads and the clipboard, so the web app asks users to switch browsers.

export type InAppBrowser = { app: string | null; os: "android" | "ios" };

// Order matters: Messenger and Instagram UAs can also carry Facebook tokens.
const APPS: [name: string, pattern: RegExp][] = [
  ["Messenger", /Messenger|Orca-Android/i],
  ["Instagram", /Instagram/i],
  ["Facebook", /FBAN|FBAV|FB_IAB|FBIOS/],
  ["Zalo", /Zalo/i],
  ["LINE", /\bLine\//],
  ["WeChat", /MicroMessenger/i],
  ["LinkedIn", /LinkedInApp/i],
  ["TikTok", /musical_ly|BytedanceWebview|TikTok/i],
  ["Snapchat", /Snapchat/i],
  ["X (Twitter)", /Twitter/i],
  ["Pinterest", /Pinterest/i],
  ["Telegram", /Telegram/i],
  ["the Google app", /\bGSA\//],
];

/** Returns the in-app browser the user agent belongs to, or null for a regular browser (or desktop). */
export function detectInAppBrowser(ua: string): InAppBrowser | null {
  const os = /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/.test(ua) ? "ios" : null;
  if (!os) return null;

  const named = APPS.find(([, re]) => re.test(ua));
  if (named) return { app: named[0], os };

  // Generic webviews: Android marks them with "; wv)", iOS ones lack the "Safari/" token real browsers send.
  if (os === "android" && /; wv\)/.test(ua)) return { app: null, os };
  if (os === "ios" && /AppleWebKit/.test(ua) && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return { app: null, os };

  return null;
}
