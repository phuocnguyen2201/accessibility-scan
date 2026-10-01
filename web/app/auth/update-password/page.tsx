import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { UpdatePasswordForm } from "@/components/auth/AuthForms";
import { currentUser } from "@/lib/supabase-server";

export const metadata = { title: "Set new password · A11y Site Scanner" };

export default async function UpdatePasswordPage() {
  // Reached through the reset link, which signs the user in via /auth/confirm.
  if (!(await currentUser())) redirect("/login?error=" + encodeURIComponent("Your reset link has expired. Request a new one."));
  return (
    <AuthCard title="Set a new password">
      <UpdatePasswordForm />
    </AuthCard>
  );
}
