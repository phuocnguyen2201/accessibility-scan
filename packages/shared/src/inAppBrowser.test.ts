import { describe, expect, it } from "vitest";
import { detectInAppBrowser } from "./inAppBrowser";

const UA = {
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/462.0.0.47.86;]",
  facebookIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/459.0.0.37.104;FBBV/585948010;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.4;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/5]",
  messengerAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.6312.99 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/453.0.0.30.109;]",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 321.0.2.25.103 (iPhone14,5; iOS 17_3; en_US; en; scale=3.00; 1170x2532; 571158325)",
  zaloAndroid:
    "Mozilla/5.0 (Linux; Android 12; SM-A525F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 Zalo android/12100625 ZaloTheme/light ZaloLanguage/vi",
  webviewAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 6; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36",
  webviewIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  safariIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  chromeIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1",
  chromeDesktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

describe("detectInAppBrowser", () => {
  it("names the app and OS for known in-app browsers", () => {
    expect(detectInAppBrowser(UA.facebookAndroid)).toEqual({ app: "Facebook", os: "android" });
    expect(detectInAppBrowser(UA.facebookIos)).toEqual({ app: "Facebook", os: "ios" });
    expect(detectInAppBrowser(UA.messengerAndroid)).toEqual({ app: "Messenger", os: "android" });
    expect(detectInAppBrowser(UA.instagramIos)).toEqual({ app: "Instagram", os: "ios" });
    expect(detectInAppBrowser(UA.zaloAndroid)).toEqual({ app: "Zalo", os: "android" });
  });

  it("flags unnamed webviews", () => {
    expect(detectInAppBrowser(UA.webviewAndroid)).toEqual({ app: null, os: "android" });
    expect(detectInAppBrowser(UA.webviewIos)).toEqual({ app: null, os: "ios" });
  });

  it("ignores regular browsers", () => {
    expect(detectInAppBrowser(UA.chromeAndroid)).toBeNull();
    expect(detectInAppBrowser(UA.safariIos)).toBeNull();
    expect(detectInAppBrowser(UA.chromeIos)).toBeNull();
    expect(detectInAppBrowser(UA.chromeDesktop)).toBeNull();
  });
});
