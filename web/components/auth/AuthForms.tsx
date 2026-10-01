"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  resendVerification,
  signIn,
  signUp,
  updatePassword,
  type AuthState,
} from "@/app/auth-actions";
import { Button } from "../ui";

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-describedby={hint ? `${name}-hint` : undefined}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
      />
      {hint && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-slate-600">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const cls = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-green-200 bg-green-50 text-green-800",
    info: "border-blue-200 bg-blue-50 text-blue-900",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border p-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

function StateNotice({ state }: { state: AuthState }) {
  if (state.error) return <Notice tone="error">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

function ResendVerification({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendVerification, {});
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="email" value={email} />
      {state.message ? (
        <Notice tone="success">{state.message}</Notice>
      ) : (
        <>
          {state.error && <Notice tone="error">{state.error}</Notice>}
          <Button type="submit" variant="secondary" disabled={pending} className="mt-2 w-full">
            {pending ? "Sending..." : "Resend verification email"}
          </Button>
        </>
      )}
    </form>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <>
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/"} />
        <StateNotice state={state} />
        <Field name="email" label="Email" type="email" autoComplete="email" defaultValue={state.email} />
        <Field name="password" label="Password" type="password" autoComplete="current-password" />
        <div className="text-right text-sm">
          <Link href="/forgot-password" className="text-blue-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      {state.unconfirmedEmail && <ResendVerification email={state.unconfirmedEmail} />}
    </>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, {});
  if (state.message) {
    return (
      <div className="space-y-4">
        <Notice tone="success">{state.message}</Notice>
        <p className="text-sm text-slate-600">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <Link href="/login" className="text-blue-700 hover:underline">
            sign in
          </Link>{" "}
          to request a new link.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <StateNotice state={state} />
      <Field name="email" label="Email" type="email" autoComplete="email" defaultValue={state.email} />
      <Field name="password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters." />
      <Field name="confirm" label="Confirm password" type="password" autoComplete="new-password" />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  return (
    <form action={action} className="space-y-4">
      <StateNotice state={state} />
      {!state.message && (
        <>
          <Field name="email" label="Email" type="email" autoComplete="email" />
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Sending..." : "Send reset link"}
          </Button>
        </>
      )}
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});
  return (
    <form action={action} className="space-y-4">
      <StateNotice state={state} />
      <Field name="password" label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." />
      <Field name="confirm" label="Confirm new password" type="password" autoComplete="new-password" />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving..." : "Set new password"}
      </Button>
    </form>
  );
}
