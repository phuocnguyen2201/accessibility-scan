import type { NextConfig } from "next";

// Share the single .env at the repo root with the worker.
try {
  process.loadEnvFile("../.env");
} catch {
  /* no root .env - rely on the environment */
}

const nextConfig: NextConfig = {
  transpilePackages: ["@a11y/shared", "@a11y/report"],
  // Load these from node_modules instead of bundling them (CommonJS / native / browser binaries).
  serverExternalPackages: ["exceljs", "playwright", "playwright-core"],
  // Never tell the browser which framework serves the owner's dashboard.
  poweredByHeader: false,
};

export default nextConfig;
