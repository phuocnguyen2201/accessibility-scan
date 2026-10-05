import type { Browser } from "playwright";
import { esc, exportBaseName, loadExportData, markdown, renderPdf, reportHtml, workbook, type ExportData } from "@a11y/report";
import { config } from "./config";
import { db } from "./db";

/** Resend allows 40 MB per email after base64 (+37%); stay well under it. */
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface Attachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

const log = (scanId: string, msg: string) => console.log(`[scan ${scanId.slice(0, 8)}] ${msg}`);

/**
 * Emails the finished scan's reports (PDF, Excel, Markdown for agents) to its owner, if they asked for it.
 * Never throws: a failed email is recorded on the scan (notify_error) and must not fail the scan itself.
 */
export async function notifyScanFinished(scanId: string, browser: Browser) {
  try {
    // Claim first, so a resumed scan or the other worker can't send the same email twice.
    const { data: claimed, error } = await db
      .from("scans")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", scanId)
      .eq("notify_email", true)
      .eq("status", "completed")
      .is("notified_at", null)
      .select("id, user_id")
      .maybeSingle<{ id: string; user_id: string | null }>();
    if (error) throw new Error(`claim notification: ${error.message}`);
    if (!claimed) return;

    try {
      await sendReport(scanId, claimed.user_id, browser);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[scan ${scanId.slice(0, 8)}] report email failed:`, message);
      await db.from("scans").update({ notify_error: message.slice(0, 500) }).eq("id", scanId);
    }
  } catch (err) {
    console.error(`[scan ${scanId.slice(0, 8)}] notification:`, err instanceof Error ? err.message : err);
  }
}

let lastSweep = 0;

/**
 * Sends emails a worker didn't get to (it stopped between finishing a scan and sending). Called when idle,
 * at most once a minute, for scans finished in the last day.
 */
export async function notifyPending(browser: () => Promise<Browser>) {
  if (Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await db
    .from("scans")
    .select("id")
    .eq("notify_email", true)
    .eq("status", "completed")
    .is("notified_at", null)
    .gt("finished_at", since)
    .limit(5);
  for (const { id } of data ?? []) await notifyScanFinished(id, await browser());
}

async function sendReport(scanId: string, userId: string | null, browser: Browser) {
  if (!config.resendApiKey || !config.emailFrom) throw new Error("Email isn't set up on the scanner (RESEND_API_KEY / EMAIL_FROM).");
  if (!userId) throw new Error("The scan has no owner to email.");

  // Only registered accounts get reports by email; guests (anonymous users) have no address anyway.
  const { data: owner, error: ownerError } = await db.auth.admin.getUserById(userId);
  if (ownerError) throw new Error(`look up owner: ${ownerError.message}`);
  const { user } = owner;
  if (user.is_anonymous || !user.email) throw new Error("Reports are only emailed to registered accounts.");
  if (!user.email_confirmed_at) throw new Error("The account's email address isn't verified yet.");

  const data = await loadExportData(db, scanId);
  if (!data) throw new Error("Scan not found.");
  const base = exportBaseName(data);

  const attachments: Attachment[] = [];
  try {
    attachments.push({ filename: `${base}.pdf`, content: await renderPdf(browser, reportHtml(data)), contentType: "application/pdf" });
  } catch (err) {
    console.error(`[scan ${scanId.slice(0, 8)}] PDF failed, sending the other reports:`, err instanceof Error ? err.message : err);
  }
  attachments.push({ filename: `${base}.xlsx`, content: await workbook(data), contentType: XLSX_TYPE });
  attachments.push({ filename: `${base}.md`, content: Buffer.from(markdown(data), "utf8"), contentType: "text/markdown" });

  // Too big for one email: keep what fits (PDF first) and point to the dashboard for the rest.
  let total = 0;
  const attached = attachments.filter((a) => (total += a.content.length) <= MAX_ATTACHMENT_BYTES);
  const left = attachments.filter((a) => !attached.includes(a));

  await sendEmail(scanId, {
    to: user.email,
    subject: subject(data),
    html: emailHtml(data, left),
    text: emailText(data, left),
    attachments: attached,
  });
  log(scanId, `report emailed (${attached.map((a) => a.filename.split(".").pop()).join(", ")})`);
}

async function sendEmail(scanId: string, email: { to: string; subject: string; html: string; text: string; attachments: Attachment[] }) {
  const body = JSON.stringify({
    from: config.emailFrom,
    to: [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: email.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64"), content_type: a.contentType })),
  });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
        // Resend drops a repeat of the same key, so a retry can't send the email twice.
        "Idempotency-Key": `scan-report-${scanId}`,
      },
      body,
      signal: AbortSignal.timeout(60_000),
    }).catch((err: Error) => err);
    if (!(res instanceof Error) && res.ok) return;
    const retryable = res instanceof Error || res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 3) {
      throw new Error(res instanceof Error ? `Email service unreachable: ${res.message}` : `Email service error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    await new Promise((r) => setTimeout(r, attempt * 5000));
  }
}

// ---------------------------------------------------------------- email content

const dashboardUrl = (data: ExportData) => `${config.siteUrl}/scans/${data.scan.id}`;

/** Average scores for the checks the scan ran, e.g. [["accessibility", 87], ["SEO", 92]]. */
function scores(data: ExportData): [string, number][] {
  const s = data.summary;
  const out: [string, number][] = [];
  if (data.checks.includes("accessibility") && s?.avg_a11y != null) out.push(["accessibility", s.avg_a11y]);
  if (data.checks.includes("seo") && s?.avg_seo != null) out.push(["SEO", s.avg_seo]);
  if (data.checks.includes("performance") && s?.avg_perf != null) out.push(["performance", s.avg_perf]);
  return out;
}

function subject(data: ExportData) {
  const list = scores(data).map(([name, value]) => `${name} ${value}`);
  return `Scan report: ${data.scan.site.normalized_url}${list.length ? ` (${list.join(", ")})` : ""}`;
}

function facts(data: ExportData): [string, string][] {
  const s = data.summary;
  const rows: [string, string][] = [["Pages scanned", String(s?.scanned_pages ?? data.scan.pages_scanned)]];
  for (const [name, value] of scores(data)) rows.push([`Average ${name} score`, String(value)]);
  if (data.checks.includes("accessibility") && s) {
    rows.push(["Critical / serious issue elements", `${s.impact_counts.critical} / ${s.impact_counts.serious}`]);
  }
  return rows;
}

function emailHtml(data: ExportData, notAttached: Attachment[]) {
  const url = dashboardUrl(data);
  const missing = notAttached.length
    ? `<p style="color:#92400e">${esc(notAttached.map((a) => a.filename).join(", "))} ${notAttached.length === 1 ? "was" : "were"} too large to attach. Download ${
        notAttached.length === 1 ? "it" : "them"
      } from the dashboard.</p>`
    : "";
  return `<!doctype html><html><body style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.5">
  <h1 style="font-size:20px;margin:0 0 4px">Your scan of ${esc(data.scan.site.normalized_url)} is finished</h1>
  <p style="color:#475569;margin:0 0 16px">${esc(data.scan.start_url)}</p>
  <table style="border-collapse:collapse;margin-bottom:16px">${facts(data)
    .map(([k, v]) => `<tr><td style="padding:2px 16px 2px 0;color:#475569">${esc(k)}</td><td style="padding:2px 0;font-weight:600">${esc(v)}</td></tr>`)
    .join("")}</table>
  <p>Attached: the full report as <strong>PDF</strong>, all findings in <strong>Excel</strong>, and a <strong>Markdown</strong> report written for AI coding agents (give it to your agent to fix the issues).</p>
  ${missing}
  <p><a href="${esc(url)}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">View results in the dashboard</a></p>
  <p style="color:#64748b;font-size:12px">You asked for this email when you started the scan.</p>
</body></html>`;
}

function emailText(data: ExportData, notAttached: Attachment[]) {
  return [
    `Your scan of ${data.scan.site.normalized_url} is finished.`,
    "",
    ...facts(data).map(([k, v]) => `${k}: ${v}`),
    "",
    "Attached: the full report as PDF, all findings in Excel, and a Markdown report written for AI coding agents.",
    ...(notAttached.length ? [`Too large to attach (download from the dashboard): ${notAttached.map((a) => a.filename).join(", ")}`] : []),
    "",
    `View results: ${dashboardUrl(data)}`,
  ].join("\n");
}
