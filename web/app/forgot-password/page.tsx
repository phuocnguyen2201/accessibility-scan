import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Reset password · A11y Site Scanner" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      footer={
        <Link href="/login" className="text-blue-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
