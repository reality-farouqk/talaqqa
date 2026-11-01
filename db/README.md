# Database

Postgres on Neon. Migrations in this folder run in order, once each, via `scripts/migrate.sh` (tracked in `schema_migrations`). The production deploy runs them automatically when the `DATABASE_URL` secret exists; CI runs them against a Postgres 16 service before the tests.

- `0001_init.sql`: catalog mirror (creators, teachers, topics, courses, sections, lessons, videos). Course files in `content/courses/` stay the source of truth.
- `0002_accounts.sql`: Better Auth tables (`user`, `session`, `account`, `verification`, `rateLimit`) and `user_items`, one row per thing a learner saves (completed lessons, Watch later, saved courses, positions, notes, playlists, study days). Sync is last-write-wins per item; deleting a user cascades to all their data.

Run locally:

```bash
DATABASE_URL=postgresql://... scripts/migrate.sh
PG_TEST_URL=postgresql://... npm test   # API tests against real Postgres
```
