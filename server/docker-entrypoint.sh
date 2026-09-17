#!/bin/sh
set -e

# Apply the Prisma schema to the database before starting the API.
# The schema is pushed (rather than migrated) so a fresh container can come up
# with zero manual steps. If you later adopt `prisma migrate`, swap this for
# `npx prisma migrate deploy`.
if [ -n "$DATABASE_URL" ]; then
  echo "▶ Applying database schema..."
  attempt=1
  max_attempts="${DB_WAIT_ATTEMPTS:-15}"
  until npx prisma db push --skip-generate; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "✖ Database did not become ready after ${max_attempts} attempts." >&2
      exit 1
    fi
    echo "… database not ready (attempt ${attempt}/${max_attempts}); retrying in 3s"
    attempt=$((attempt + 1))
    sleep 3
  done
fi

exec "$@"
