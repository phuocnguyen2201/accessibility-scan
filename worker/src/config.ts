function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (see .env.example)`);
  return v;
}

export const config = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  maxPagesCap: num("MAX_PAGES_CAP", 800),
  defaultMaxPages: num("DEFAULT_MAX_PAGES", 800),
  defaultLighthouseSample: num("DEFAULT_LIGHTHOUSE_SAMPLE", 50),
  concurrency: num("WORKER_CONCURRENCY", 4),
  pollMs: num("WORKER_POLL_MS", 3000),
  pageTimeoutMs: num("PAGE_TIMEOUT_MS", 30000),
  requestDelayMs: num("REQUEST_DELAY_MS", 250),
  blockPrivateIps: process.env.BLOCK_PRIVATE_IPS !== "false",
  /** Run the Lighthouse queue in this worker. With several workers on one small host, enable it on only one. */
  lighthouseEnabled: process.env.LIGHTHOUSE_ENABLED !== "false",
  maxAttempts: 2,
  userAgentSuffix: "A11yScanBot/0.1",
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
