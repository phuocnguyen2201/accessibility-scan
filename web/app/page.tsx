import { HistoryList } from "@/components/HistoryList";
import { Notice } from "@/components/auth/AuthForms";
import { ScanForm } from "@/components/ScanForm";
import { limits } from "@/lib/supabase-admin";

// Reads MAX_PAGES_CAP etc. at request time so limits can change without a rebuild.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ verified?: string }> }) {
  const { verified } = await searchParams;
  return (
    <>
      {verified && (
        <div className="mb-6">
          <Notice tone="success">Your email is verified. Welcome! Your scans are private to your account.</Notice>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Scan a website</h1>
          <p className="mb-6 text-slate-600">
            Crawls every internal page, then checks accessibility (axe-core), SEO and performance (Lighthouse).
          </p>
          <ScanForm
            maxPagesCap={limits.maxPagesCap}
            defaultMaxPages={limits.defaultMaxPages}
            defaultLighthouseSample={limits.defaultLighthouseSample}
          />
        </div>
        <HistoryList />
      </div>
    </>
  );
}
