FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/admin-web/package.json apps/admin-web/package.json
RUN pnpm install --filter @police/admin-web... --prod=false --frozen-lockfile=false
COPY apps/admin-web apps/admin-web
RUN pnpm --filter @police/admin-web build
FROM nginx:1.27-alpine
COPY --from=build /app/apps/admin-web/dist/admin-web/browser /usr/share/nginx/html
