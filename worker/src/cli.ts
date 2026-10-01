/**
 * Usage: npm run scan -- https://example.com --email you@example.com [--max 100] [--lighthouse 5]
 * Queues a scan for the URL, owned by the given account, and runs this worker until that scan finishes.
 */
import { normalizeUrl } from "@a11y/shared";
import { config } from "./config";
import { check, db } from "./db";
import { scanLoop } from "./index";
import { lighthouseLoop } from "./lighthouse";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const num = (name: string) => (flag(name) == null ? undefined : Number(flag(name)));
const input = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const target = input ? normalizeUrl(input) : null;
if (!target) {
  console.error("Usage: npm run scan -- <url> --email <account email> [--max 100] [--lighthouse 5]");
  process.exit(1);
}

// Scans are private to their owner, so the CLI needs to know whose history to put this in.
const email = flag("email")?.toLowerCase();
if (!email) {
  console.error("Missing --email: the scan must belong to a registered account to show up in the UI.");
  process.exit(1);
}
let userId: string | undefined;
for (let page = 1; !userId; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (data.users.length < 1000) break;
}
if (!userId) {
  console.error(`No account found for ${email}. Sign up in the web app first.`);
  process.exit(1);
}

const maxPages = Math.min(num("max") ?? config.defaultMaxPages, config.maxPagesCap);
const lighthouseSample = num("lighthouse") ?? config.defaultLighthouseSample;

const site = check(
  await db
    .from("sites")
    .upsert({ user_id: userId, normalized_url: target.key, display_url: target.url }, { onConflict: "user_id,normalized_url" })
    .select()
    .single(),
  "upsert site",
);
const scan = check(
  await db
    .from("scans")
    .insert({ site_id: site.id, user_id: userId, start_url: target.url, max_pages: maxPages, lighthouse_sample: lighthouseSample })
    .select()
    .single(),
  "create scan",
);
await db.from("sites").update({ last_scan_id: scan.id }).eq("id", site.id);
console.log(`queued scan ${scan.id} for ${target.url}`);

const lighthouseStop = new AbortController();
const lh = lighthouseLoop(lighthouseStop.signal);
await scanLoop(new AbortController().signal, scan.id);
lighthouseStop.abort();
await lh;

const { data } = await db.from("scans").select("status, pages_found, pages_scanned, summary").eq("id", scan.id).single();
console.log(JSON.stringify(data, null, 2));
process.exit(0);
