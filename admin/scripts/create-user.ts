// Creates or replaces the local admin account (ADMIN_DATA_DIR/admin.json). Run on the Pi:
//   docker compose run --rm admin npm run create-user
// or locally: npm run admin:create-user
// Changing the password signs out every existing session.
import { createInterface } from "node:readline";
import { readAccount, writeAccount } from "../lib/account";
import { hashPassword } from "../lib/password";

// One interface for every question, so piped input (printf 'user\npw\npw\n' | ...) isn't lost between them.
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
const lines = rl[Symbol.asyncIterator]();
let muted = false;
// Echo nothing while a password is typed.
const internals = rl as unknown as { _writeToOutput: (s: string) => void };
const write = internals._writeToOutput.bind(rl);
internals._writeToOutput = (s: string) => {
  if (!muted) write(s);
};

async function ask(question: string, hidden = false): Promise<string> {
  process.stdout.write(question);
  muted = hidden;
  const { value } = await lines.next();
  muted = false;
  if (hidden) process.stdout.write("\n");
  return String(value ?? "").trim();
}

async function main() {
  const existing = await readAccount();
  const username = (await ask(`Username${existing ? ` [${existing.username}]` : ""}: `)) || existing?.username || "";
  if (!/^[\w.@-]{3,64}$/.test(username)) {
    console.error("Username: 3-64 letters, digits or . _ @ -");
    process.exit(1);
  }
  const password = await ask("Password (min 12 characters): ", true);
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }
  if ((await ask("Repeat password: ", true)) !== password) {
    console.error("Passwords don't match.");
    process.exit(1);
  }

  const file = await writeAccount({ username, passwordHash: await hashPassword(password), updatedAt: new Date().toISOString() });
  console.log(`${existing ? "Updated" : "Created"} admin account "${username}" in ${file}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
