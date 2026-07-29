FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @police/api... --prod=false --frozen-lockfile=false
COPY apps/api apps/api
RUN pnpm --filter @police/api prisma:generate && pnpm --filter @police/api build
FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY --from=build /app /app
CMD ["pnpm","--filter","@police/api","start:prod"]
