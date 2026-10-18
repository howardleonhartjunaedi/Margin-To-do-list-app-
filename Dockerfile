# syntax=docker/dockerfile:1
# Margin — production image. Build: docker build -t margin .   Run: see docker-compose.yml

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The front page is prerendered, so its absolute URLs (language alternates) are fixed at build time.
ARG BETTER_AUTH_URL=http://localhost:3000
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone BETTER_AUTH_URL=${BETTER_AUTH_URL}
RUN npm run build

# The web app: Next's standalone server, its static files, and the SQL migrations it runs on start.
FROM node:${NODE_VERSION} AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S margin && adduser -S margin -G margin
COPY --from=build --chown=margin:margin /app/.next/standalone ./
COPY --from=build --chown=margin:margin /app/.next/static ./.next/static
COPY --from=build --chown=margin:margin /app/public ./public
COPY --from=build --chown=margin:margin /app/drizzle ./drizzle
USER margin
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null || exit 1
CMD ["node", "server.js"]

# Optional: reminder workers separate from the web app (set SCHEDULER=off on the app).
FROM node:${NODE_VERSION} AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node
CMD ["npx", "tsx", "scripts/worker.ts"]
