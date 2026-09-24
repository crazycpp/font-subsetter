FROM node:22-alpine AS build

WORKDIR /app
ARG PUBLIC_ENABLE_CFF_SUBSET
ENV PUBLIC_ENABLE_CFF_SUBSET=$PUBLIC_ENABLE_CFF_SUBSET

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches

RUN corepack enable && pnpm install --frozen-lockfile

COPY svelte.config.js tsconfig.json vite.config.ts ./
COPY src ./src
COPY static ./static

RUN pnpm build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
COPY LICENSE THIRD_PARTY_NOTICES.md /usr/share/nginx/html/licenses/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
