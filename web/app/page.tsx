import { HistoryList } from "@/components/HistoryList";
import { Notice } from "@/components/auth/AuthForms";
import { ScanForm } from "@/components/ScanForm";
import Link from "next/link";
import { guestLimits, limits } from "@/lib/supabase-admin";
import { currentUser } from "@/lib/supabase-server";
import { isGuest, minutesUntil, nextGuestScanAt, requesterIpHash } from "@/lib/guest";

// Reads MAX_PAGES_CAP etc. at request time so limits can change without a rebuild.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ verified?: string }> }) {
  const { verified } = await searchParams;
  const user = await currentUser();
  const guest = isGuest(user);
  const nextScan = guest && user ? await nextGuestScanAt(user, await requesterIpHash()) : null;
  return (
    <>
      {verified && (
        <div className="mb-6">
          <Notice tone="success">Your email is verified. Welcome! Your scans are private to your account.</Notice>
        </div>
      )}
      {guest && (
        <div className="mb-6">
          <Notice tone="info">
            You&apos;re scanning as a guest: one scan every {guestLimits.cooldownMinutes} minutes, up to {guestLimits.maxPages} pages.{" "}
            {nextScan ? <strong>Your next scan is available in {minutesUntil(nextScan)}.</strong> : "You can start a scan now."}{" "}
            <Link href="/signup" className="font-medium underline">
              Create a free account
            </Link>{" "}
            to scan without waiting.
          </Notice>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Scan a website</h1>
          <p className="mb-6 text-slate-600">
            Crawls every internal page, then checks accessibility (axe-core), SEO and performance (Lighthouse).
          </p>
          <ScanForm
            maxPagesCap={guest ? guestLimits.maxPages : limits.maxPagesCap}
            defaultMaxPages={guest ? guestLimits.maxPages : limits.defaultMaxPages}
            defaultLighthouseSample={guest ? guestLimits.lighthouseSample : limits.defaultLighthouseSample}
            maxLighthouseSample={guest ? guestLimits.lighthouseSample : undefined}
          />
        </div>
        <HistoryList />
      </div>
    </>
  );
}
