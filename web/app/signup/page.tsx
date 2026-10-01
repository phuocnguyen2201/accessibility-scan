import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Create account · A11y Site Scanner" };

export default function SignupPage() {
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
      <SignupForm />
    </AuthCard>
  );
}
