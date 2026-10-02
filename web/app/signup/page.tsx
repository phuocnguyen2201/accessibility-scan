import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Notice, SignupForm } from "@/components/auth/AuthForms";
import { currentUser } from "@/lib/supabase-server";

export const metadata = { title: "Create account · A11y Site Scanner" };

export default async function SignupPage() {
  const user = await currentUser();
  return (
    <AuthCard
      title="Create your account"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-blue-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {user?.is_anonymous && (
        <div className="mb-4">
          <Notice tone="info">Scans you ran as a guest stay in the guest session and aren&apos;t moved to your new account.</Notice>
        </div>
      )}
      <SignupForm />
    </AuthCard>
  );
}
