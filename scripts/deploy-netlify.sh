#!/usr/bin/env bash
# Builds and deploys web/ to Netlify from a Linux container.
# Why: on Windows, `netlify deploy --build` fails while bundling proxy.ts (the Netlify Next.js
# adapter mangles Windows paths). Building on Linux avoids it. Requires Docker Desktop to be running.
#
# Usage:  npm run deploy:netlify            (production)
#         npm run deploy:netlify -- --draft (preview URL only)
set -euo pipefail

SITE_ID="5e6067b1-6e17-43c0-8705-bca3e255645b" # accessibility-scan.netlify.app
ROOT="$(cd "$(dirname "$0")/.." && (pwd -W 2>/dev/null || pwd))" # pwd -W gives D:/... paths in Git Bash
MODE="--prod"
[[ "${1:-}" == "--draft" ]] && MODE=""

# Reuse the Netlify CLI login (run `netlify login` once) unless a token is already set.
if [[ -z "${NETLIFY_AUTH_TOKEN:-}" ]]; then
  NETLIFY_AUTH_TOKEN="$(node -e '
    const p = require("path"), os = require("os");
    const dir = process.env.APPDATA ? p.join(process.env.APPDATA, "netlify", "Config") : p.join(os.homedir(), ".config", "netlify");
    const c = require(p.join(dir, "config.json"));
    process.stdout.write(c.users[c.userId].auth.token);
  ')"
fi
export NETLIFY_AUTH_TOKEN

MSYS_NO_PATHCONV=1 docker run --rm \
  -e NETLIFY_AUTH_TOKEN -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  -v "$ROOT:/src:ro" \
  node:24-bookworm bash -lc "
    set -e
    mkdir /app && cd /src
    # Copy sources only: no Windows node_modules, build output, git history or .env.
    tar --exclude='*/node_modules' --exclude=./node_modules --exclude=.next --exclude=.netlify \
        --exclude=.git --exclude=.env --exclude=./admin-data -cf - . | (cd /app && tar xf -)
    cd /app && npm ci --no-audit --no-fund --loglevel=error
    npm i -g netlify-cli@27.10.2 --no-audit --no-fund --loglevel=error > /dev/null
    netlify deploy --build $MODE --filter web --site $SITE_ID
  "
