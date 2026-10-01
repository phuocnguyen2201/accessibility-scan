FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY web web
RUN npm ci --workspace web --include-workspace-root
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build -w web
WORKDIR /app/web
EXPOSE 3000
CMD ["npx", "next", "start"]
