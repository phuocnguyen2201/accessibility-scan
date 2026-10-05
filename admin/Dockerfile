# Owner-only usage dashboard. Runs on the Pi only, never on Netlify.
# Playwright image: Chromium for the snapshot PDF / PNG exports (same base as the worker, so layers are shared).
FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/report packages/report
COPY admin admin
RUN npm ci --workspace admin --include-workspace-root --ignore-scripts
RUN npm run build -w admin
WORKDIR /app/admin
ENV ADMIN_DATA_DIR=/data
EXPOSE 3001
CMD ["npx", "next", "start", "-p", "3001"]
