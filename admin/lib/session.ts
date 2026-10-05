import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readAccount, type AdminAccount } from "./account";

// The admin account lives only on the Pi (ADMIN_DATA_DIR/admin.json, written by scripts/create-user.ts),
// never in Supabase. Sessions are HMAC-signed cookies; changing the password ends every session.
// No Next.js imports here: proxy.ts uses this too.

export const SESSION_COOKIE = "admin_session";
const SESSION_HOURS = 12;

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("ADMIN_SESSION_SECRET must be set to at least 32 random characters.");
  return s;
}

/** Short fingerprint of the password hash: a new password invalidates sessions signed for the old one. */
const accountVersion = (a: AdminAccount) => createHash("sha256").update(a.passwordHash).digest("base64url").slice(0, 12);

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSessionToken(account: AdminAccount) {
  const payload = Buffer.from(
    JSON.stringify({ u: account.username, v: accountVersion(account), exp: Date.now() + SESSION_HOURS * 3_600_000 }),
  ).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, maxAge: SESSION_HOURS * 3600 };
}

/** The signed-in username, or null. Checks the signature, expiry and that the password hasn't changed. */
export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  try {
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const { u, v, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof exp !== "number" || exp < Date.now()) return null;
    const account = await readAccount();
    if (!account || account.username !== u || accountVersion(account) !== v) return null;
    return u;
  } catch {
    return null;
  }
}

