"use client";

import { useEffect, useId, useState } from "react";
import { ExternalLink, TriangleAlert, X } from "lucide-react";
import { detectInAppBrowser, type InAppBrowser } from "@a11y/shared";
import { CopyButton } from "./CopyButton";

const DISMISS_KEY = "in-app-notice-dismissed";

/** Android intent that asks the OS to open the current page in the default browser. */
function androidIntentUrl(href: string) {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=${u.protocol.replace(":", "")};action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}

/** Warns users inside a social / chat app's built-in browser and tells them how to switch to their main browser. */
export function InAppBrowserNotice() {
  const [info, setInfo] = useState<(InAppBrowser & { href: string }) | null>(null);
  const headingId = useId();

  // Detection needs the real user agent, so it only runs on the client (the server renders nothing).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* storage unavailable - just show the notice */
    }
    const found = detectInAppBrowser(navigator.userAgent);
    if (found) setInfo({ ...found, href: window.location.href });
  }, []);

  if (!info) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable - it'll come back on the next page */
    }
    setInfo(null);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4">
      <section aria-labelledby={headingId} className="relative rounded-lg border border-amber-200 bg-amber-50 p-4 pr-12 text-amber-900">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notice"
          className="absolute right-2 top-2 rounded-md p-1.5 hover:bg-amber-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <h2 id={headingId} className="flex items-center gap-2 font-semibold">
          <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
          You&apos;re viewing this in {info.app ?? "an in-app browser"}
        </h2>
        <p className="mt-1 text-sm">
          Some features (sign-in, exports, copying) may not work fully here. For the best experience, open this page in your main browser.
        </p>
        <p className="mt-2 text-sm">
          {info.os === "android" ? (
            <>
              Tap the <strong>⋮</strong> menu at the top right of the screen, then choose <strong>Open in browser</strong> (or{" "}
              <strong>Open in Chrome</strong>).
            </>
          ) : (
            <>
              Tap the <strong>•••</strong> or share icon at the top right of the screen (bottom right in some apps), then choose{" "}
              <strong>Open in Safari</strong> or <strong>Open in browser</strong>.
            </>
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {info.os === "android" && (
            <a
              href={androidIntentUrl(info.href)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open in browser
            </a>
          )}
          <CopyButton text={info.href} label="link to this page" />
        </div>
      </section>
    </div>
  );
}
