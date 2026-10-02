import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { GuestForm, LoginForm, Notice } from "@/components/auth/AuthForms";
import { guestLimits } from "@/lib/supabase-admin";

export const metadata = { title: "Sign in · A11y Site Scanner" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          No account yet?{" "}
          <Link href="/signup" className="text-blue-700 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <LoginForm next={next} />
      <div className="my-5 flex items-center gap-3 text-xs uppercase text-slate-500" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <GuestForm next={next} cooldownMinutes={guestLimits.cooldownMinutes} />
    </AuthCard>
  );
}
