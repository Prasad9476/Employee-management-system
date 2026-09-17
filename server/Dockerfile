FROM node:20-alpine

WORKDIR /app

# Install dependencies (including the Prisma CLI, which the entrypoint uses to
# provision the database). `--include=dev` keeps devDependencies even when
# NODE_ENV=production is present in the build environment.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev

# The committed schema targets SQLite for zero-config local dev/tests. For the
# production image we generate a Postgres client from the same schema so there
# is a single source of truth.
RUN sed 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma > prisma/schema.postgres.prisma \
  && cp prisma/schema.postgres.prisma prisma/schema.prisma \
  && npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
