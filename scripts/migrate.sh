#!/usr/bin/env bash
# Applies db/NNNN_*.sql files that haven't run yet, each in one transaction, recording them in
# schema_migrations. Safe to run repeatedly. Usage: DATABASE_URL=postgresql://... scripts/migrate.sh
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is not set}"
run() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }
run -c "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())"
for file in db/[0-9]*.sql; do
  name=$(basename "$file")
  if [ -z "$(run -At -c "select 1 from schema_migrations where name = '$name'")" ]; then
    echo "Applying $name"
    run --single-transaction -f "$file" -c "insert into schema_migrations (name) values ('$name')"
  fi
done
echo "Migrations up to date."
