import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm, Notice } from "@/components/auth/AuthForms";

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
    </AuthCard>
  );
}
