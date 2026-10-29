# Database

`0001_init.sql` is the Postgres schema for Neon. It is not wired to the site yet: the build reads `content/courses/*.yaml` directly. Phase 2 adds a sync script that upserts those files into Postgres and refreshes YouTube metadata, plus the API for per-user data.

- **Content**: `creators` (course owner: today the Talaqqa curators, later outside creators), `teachers`, `topics`, `courses` → `sections` → `lessons` → `videos`.
- **Per user** (Better Auth `user_id`): `playlists` + `playlist_items`, `watchlist_items` (a course or a lesson), `lesson_progress`, `lesson_notes`, `study_days`.

Apply locally:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/0001_init.sql
```
