import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { logout } from "./login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scanner Admin",
  robots: { index: false, follow: false },
};

// Runs before first paint so there is no flash of the wrong theme.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
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
            <div className="flex items-center gap-5">
              <Link href="/" className="text-lg font-bold text-slate-900">
                Scanner Admin
              </Link>
              {user && (
                <nav aria-label="Main" className="flex gap-4 text-sm">
                  <Link href="/" className="text-slate-700 hover:text-slate-900">
                    Dashboard
                  </Link>
                  <Link href="/snapshot" className="text-slate-700 hover:text-slate-900">
                    Snapshot
                  </Link>
                </nav>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <ThemeToggle />
              {user && (
                <form action={logout}>
                  <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-800 hover:bg-slate-50">
                    Sign out
                  </button>
                </form>
              )}
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
