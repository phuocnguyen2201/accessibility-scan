"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LighthouseStatus } from "@a11y/shared";
import { requestLighthouse } from "@/app/actions";
import { browserClient } from "@/lib/supabase";
import { Button } from "./ui";

export function LighthouseButton({ pageId, status: initial }: { pageId: string; status: LighthouseStatus }) {
  const [status, setStatus] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const busy = status === "queued" || status === "running";

  useEffect(() => {
    if (!busy) return;
    const db = browserClient();
    const channel = db
      .channel(`lh-${pageId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pages", filter: `id=eq.${pageId}` }, (payload) => {
        const next = (payload.new as { lighthouse_status: LighthouseStatus }).lighthouse_status;
        setStatus(next);
        if (next === "done" || next === "failed") router.refresh();
      })
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [busy, pageId, router]);

  return (
    <div className="flex items-center gap-2" aria-live="polite">
      {status === "failed" && <span className="text-xs text-red-700">Last run failed</span>}
      <Button
        variant="secondary"
        disabled={busy || pending}
        onClick={() =>
          startTransition(async () => {
            await requestLighthouse(pageId);
            setStatus("queued");
          })
        }
      >
        {status === "queued" ? "Lighthouse queued..." : status === "running" ? "Running Lighthouse..." : status === "done" ? "Re-run Lighthouse" : "Run Lighthouse"}
      </Button>
    </div>
  );
}
