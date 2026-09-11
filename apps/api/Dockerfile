FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace

FROM base AS dependencies
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS development
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter", "@rechnungswerk/api", "dev"]

FROM dependencies AS build
COPY . .
RUN pnpm --filter @rechnungswerk/shared build && pnpm --filter @rechnungswerk/api build

FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /workspace
RUN apk add --no-cache dumb-init libc6-compat && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /workspace/node_modules ./node_modules
COPY --from=build --chown=app:app /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=app:app /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=app:app /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=app:app /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=app:app /workspace/packages/shared/package.json ./packages/shared/package.json
USER app
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "node apps/api/dist/database/run-migrations.js && node apps/api/dist/database/seed.js && node apps/api/dist/main.js"]
