import { accountExists } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const ready = await accountExists();
  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Admin sign in</h1>
      <p className="mb-5 mt-1 text-sm text-slate-600">Usage statistics for the scanner. Local account on the Pi.</p>
      {ready ? (
        <LoginForm />
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No admin account yet. On the Pi, run <code>docker compose run --rm admin npm run create-user</code>.
        </p>
      )}
    </div>
  );
}
