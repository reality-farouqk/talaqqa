-- Talaqqa schema for Neon Postgres (Phase 2 wires it in; the site reads content/courses/*.yaml until then).
-- Course files stay the source of truth for curated content: a sync script upserts them by slug.
-- User tables (accounts, sessions) are created by Better Auth; user_id below is its text id.

begin;

-- Who owns a course. Today one "talaqqa" curator; later, creators submitting their own courses.
create table creators (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  name        text not null,
  kind        text not null default 'curator' check (kind in ('curator', 'creator')),
  verified    boolean not null default false,
  user_id     text unique,                     -- set when a creator signs in to manage their courses
  created_at  timestamptz not null default now()
);

-- The scholar or channel credited on lessons (not necessarily the course owner).
create table teachers (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  name        text not null,
  url         text,                            -- channel or official page
  youtube_channel_id text unique,
  created_at  timestamptz not null default now()
);

create table topics (
  id          bigint generated always as identity primary key,
  track       text not null check (track in ('arabic', 'islam')),
  slug        text not null,
  name        text not null,
  name_ar     text,
  unique (track, slug)
);

create table courses (
  id            bigint generated always as identity primary key,
  slug          text not null unique,
  creator_id    bigint not null references creators(id),
  teacher_id    bigint references teachers(id),
  topic_id      bigint not null references topics(id),
  title         text not null,
  summary       text not null,
  description   text,
  outcomes      text[] not null default '{}',   -- "what you'll learn"
  level         text not null check (level in ('foundations', 'beginner', 'intermediate', 'advanced')),
  position      int not null default 99,        -- order within track + level
  language      text not null default 'en',
  status        text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'removed')),
  source_url    text,
  playlist_url  text,
  verified_at   date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index courses_listing on courses (status, topic_id, level, position);
create index courses_teacher on courses (teacher_id);
create index courses_creator on courses (creator_id);

create table course_prerequisites (
  course_id        bigint not null references courses(id) on delete cascade,
  requires_course  bigint not null references courses(id) on delete cascade,
  primary key (course_id, requires_course),
  check (course_id <> requires_course)
);

create table sections (
  id          bigint generated always as identity primary key,
  course_id   bigint not null references courses(id) on delete cascade,
  slug        text not null,
  title       text not null,
  position    int not null,
  unique (course_id, slug),
  unique (course_id, position) deferrable initially deferred
);

-- One row per external video. Metadata is refreshed from the YouTube Data API on a schedule; video is never stored.
create table videos (
  id             bigint generated always as identity primary key,
  provider       text not null default 'youtube' check (provider in ('youtube')),
  external_id    text not null,
  title          text,
  channel_id     text,
  duration_sec   int,
  published_at   timestamptz,
  thumbnail_url  text,
  embeddable     boolean,
  availability   text not null default 'unknown' check (availability in ('ok', 'private', 'removed', 'unknown')),
  checked_at     timestamptz,
  unique (provider, external_id)
);
create index videos_unavailable on videos (availability) where availability <> 'ok';

create table lessons (
  id             bigint generated always as identity primary key,
  section_id     bigint not null references sections(id) on delete cascade,
  video_id       bigint not null references videos(id),
  slug           text not null,
  title          text not null,
  summary        text,
  position       int not null,
  start_seconds  int check (start_seconds >= 0),
  end_seconds    int check (end_seconds > 0),
  unique (section_id, position) deferrable initially deferred,
  check (end_seconds is null or start_seconds is null or end_seconds > start_seconds)
);
create index lessons_video on lessons (video_id);
-- Lesson slugs are unique per course (sections are a grouping only).
create table lesson_slugs (
  course_id  bigint not null references courses(id) on delete cascade,
  slug       text not null,
  lesson_id  bigint not null unique references lessons(id) on delete cascade,
  primary key (course_id, slug)
);

-- Per-user data. Every query filters by user_id taken from the session, never from the client.
create table playlists (
  id          bigint generated always as identity primary key,
  user_id     text not null,
  title       text not null check (length(title) between 1 and 120),
  description text check (length(description) <= 1000),
  visibility  text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  share_slug  text unique,                     -- set when made unlisted/public
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index playlists_user on playlists (user_id);

create table playlist_items (
  playlist_id  bigint not null references playlists(id) on delete cascade,
  lesson_id    bigint not null references lessons(id) on delete cascade,
  position     int not null,
  added_at     timestamptz not null default now(),
  primary key (playlist_id, lesson_id),
  unique (playlist_id, position) deferrable initially deferred
);

-- Watch later: a whole course or a single lesson.
create table watchlist_items (
  user_id    text not null,
  course_id  bigint references courses(id) on delete cascade,
  lesson_id  bigint references lessons(id) on delete cascade,
  added_at   timestamptz not null default now(),
  check ((course_id is null) <> (lesson_id is null))
);
create unique index watchlist_course on watchlist_items (user_id, course_id) where course_id is not null;
create unique index watchlist_lesson on watchlist_items (user_id, lesson_id) where lesson_id is not null;

create table lesson_progress (
  user_id          text not null,
  lesson_id        bigint not null references lessons(id) on delete cascade,
  position_seconds int not null default 0 check (position_seconds >= 0),
  completed_at     timestamptz,
  updated_at       timestamptz not null default now(),  -- last write wins when syncing offline changes
  primary key (user_id, lesson_id)
);
create index lesson_progress_recent on lesson_progress (user_id, updated_at desc);

create table lesson_notes (
  user_id     text not null,
  lesson_id   bigint not null references lessons(id) on delete cascade,
  body        text not null check (length(body) <= 20000),
  updated_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- Light daily nudge: one row per day the user finished at least one lesson.
create table study_days (
  user_id  text not null,
  day      date not null,
  primary key (user_id, day)
);

commit;
