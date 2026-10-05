import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

// The admin account file. Plain Node (no server-only) so scripts/create-user.ts can use it too.

export interface AdminAccount {
  username: string;
  /** scrypt$N$r$p$salt$hash */
  passwordHash: string;
  updatedAt: string;
}

/** ADMIN_DATA_DIR (a Docker volume on the Pi), else ../admin-data next to the repo's .env. */
export const adminFile = () => join(resolve(process.env.ADMIN_DATA_DIR ?? resolve(/* turbopackIgnore: true */ process.cwd(), "..", "admin-data")), "admin.json");

export async function readAccount(): Promise<AdminAccount | null> {
  try {
    const a = JSON.parse(await readFile(adminFile(), "utf8"));
    return typeof a?.username === "string" && typeof a?.passwordHash === "string" ? a : null;
  } catch {
    return null;
  }
}

export async function writeAccount(account: AdminAccount) {
  const file = adminFile();
  await mkdir(dirname(file), { recursive: true });
  // Owner read/write only.
  await writeFile(file, `${JSON.stringify(account, null, 2)}\n`, { mode: 0o600 });
  return file;
}
