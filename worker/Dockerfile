# Playwright image ships Chromium + all system deps (also used by Lighthouse).
FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY worker worker
RUN npm ci --workspace worker --include-workspace-root --ignore-scripts
WORKDIR /app/worker
CMD ["npx", "tsx", "src/index.ts"]
