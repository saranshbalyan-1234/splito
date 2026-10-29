# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM oven/bun:1.4.2-alpine
WORKDIR /app
COPY packages packages
COPY apps/api apps/api
# ponytail: a bun workspace stands in for the pnpm one, so transitive versions are not locked; switch to a pruned pnpm lockfile before production.
RUN echo '{"private":true,"workspaces":["apps/api","packages/*"]}' > package.json && bun install --production
ENV NODE_ENV=production
USER bun
EXPOSE 3000
CMD ["bun", "apps/api/src/server.ts"]
