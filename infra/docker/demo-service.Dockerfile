# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json eslint.config.mjs ./
COPY apps/demo-service/package.json apps/demo-service/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/demo-service apps/demo-service
RUN pnpm --filter @opspilot/demo-service build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/demo-service/dist ./dist
CMD ["node", "dist/main.js"]
