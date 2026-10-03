import type { NextConfig } from "next";

// Share the single .env at the repo root with the worker.
try {
  process.loadEnvFile("../.env");
} catch {
  /* no root .env - rely on the environment */
}

const nextConfig: NextConfig = {
  transpilePackages: ["@a11y/shared", "@a11y/report"],
  // exceljs is CommonJS with optional native deps; load it from node_modules instead of bundling it.
  serverExternalPackages: ["exceljs"],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
