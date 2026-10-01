import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/supabase-server";
import { signOut } from "./auth-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "A11y Site Scanner",
  description: "Crawl a website and audit every page for accessibility, SEO and performance.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-slate-900">
              A11y Site Scanner
            </Link>
            {user && (
              <div className="flex items-center gap-3 text-sm">
                <span className="hidden text-slate-600 sm:inline">{user.email}</span>
                <form action={signOut}>
                  <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-800 hover:bg-slate-50">
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
