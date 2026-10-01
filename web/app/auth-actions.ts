"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serverClient } from "@/lib/supabase-server";

export interface AuthState {
  error?: string;
  message?: string;
  /** Set when sign-in failed because the email isn't verified yet, so the form can offer a resend. */
  unconfirmedEmail?: string;
  /** Echoed back so the email field survives the form reset after a failed submit. */
  email?: string;
}

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const password = z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters");

/** Base URL used in email links. Set SITE_URL in production; falls back to the request's origin. */
async function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Only allow same-site relative redirects after login. */
function safeNext(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password") }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  const typedEmail = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: typedEmail };

  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please verify your email address before signing in.", unconfirmedEmail: parsed.data.email, email: typedEmail };
    }
    return { error: error.code === "invalid_credentials" ? "Incorrect email or password." : error.message, email: typedEmail };
  }
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email, password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] })
    .safeParse({ email: form.get("email"), password: form.get("password"), confirm: form.get("confirm") });
  const typedEmail = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: typedEmail };

  const supabase = await serverClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/` },
  });
  if (error) return { error: error.message, email: typedEmail };

  // With "Confirm email" disabled in Supabase the user is signed in immediately.
  if (data.session) redirect("/");

  // Same message whether or not the address was already registered, so accounts can't be enumerated.
  return {
    message: `We sent a verification link to ${parsed.data.email}. Open it to activate your account, then sign in.`,
  };
}

export async function resendVerification(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address" };
  const supabase = await serverClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/` },
  });
  if (error) return { error: error.message, unconfirmedEmail: parsed.data };
  return { message: `A new verification link was sent to ${parsed.data}.` };
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address" };
  const supabase = await serverClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/auth/update-password`,
  });
  return { message: "If an account exists for that email, a password reset link is on its way." };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "Passwords do not match" })
    .safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await serverClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signOut() {
  const supabase = await serverClient();
  await supabase.auth.signOut();
  redirect("/login");
}
