import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/supabase-server";
import { InAppBrowserNotice } from "@/components/InAppBrowserNotice";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "./auth-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "A11y Site Scanner",
  description: "Crawl a website and audit every page for accessibility, SEO and performance.",
};

// Runs before first paint so there is no flash of the wrong theme.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-slate-900">
              A11y Site Scanner
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <ThemeToggle />
              {user && (
                <>
                  {user.is_anonymous ? (
                    <>
                      <span className="hidden text-slate-600 sm:inline">Guest</span>
                      <Link href="/signup" className="rounded-md bg-blue-700 px-3 py-1.5 font-medium text-white hover:bg-blue-800">
                        Create account
                      </Link>
                    </>
                  ) : (
                    <span className="hidden text-slate-600 sm:inline">{user.email}</span>
                  )}
                  <form action={signOut}>
                    <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-800 hover:bg-slate-50">
                      {user.is_anonymous ? "Leave guest mode" : "Sign out"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </header>
        <InAppBrowserNotice />
        <main id="main" className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
