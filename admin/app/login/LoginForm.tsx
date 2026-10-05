"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const input = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium text-slate-800">
        Username
        <input name="username" autoComplete="username" required className={input} />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>
      {state.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
