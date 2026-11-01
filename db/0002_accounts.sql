-- Accounts (Better Auth tables, from better-auth 1.7 getAuthTables) and per-user learning data.


create table "user" (
  id              text primary key,
  name            text not null,
  email           text not null unique,
  "emailVerified" boolean not null,
  image           text,
  "createdAt"     timestamptz not null,
  "updatedAt"     timestamptz not null
);

create table session (
  id          text primary key,
  "expiresAt" timestamptz not null,
  token       text not null unique,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId"    text not null references "user"(id) on delete cascade
);
create index session_by_user on session ("userId");

create table account (
  id                      text primary key,
  "accountId"             text not null,
  "providerId"            text not null,
  "userId"                text not null references "user"(id) on delete cascade,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope                   text,
  password                text,
  "createdAt"             timestamptz not null,
  "updatedAt"             timestamptz not null
);
create index account_by_user on account ("userId");

create table verification (
  id          text primary key,
  identifier  text not null,
  value       text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null
);
create index verification_identifier on verification (identifier);

create table "rateLimit" (
  id            text primary key,
  key           text not null unique,
  count         integer not null,
  "lastRequest" bigint not null
);

-- Everything a learner saves, one row per item, mirroring the device store:
--   done / saved / watch / position / note / playlist / day.
-- Sync is last-write-wins per item using the client's change time (ms), so replays are harmless.
-- Lessons are referenced by their stable "course/lesson" key from the course files.
create table user_items (
  user_id     text not null references "user"(id) on delete cascade,
  kind        text not null check (kind in ('done', 'saved', 'watch', 'position', 'note', 'playlist', 'day')),
  key         text not null check (length(key) between 1 and 200),
  value       jsonb not null,
  updated_at  bigint not null,
  primary key (user_id, kind, key)
);
create index user_items_changes on user_items (user_id, updated_at);
-- Public playlist links look playlists up by id across users.
create index user_items_playlists on user_items (key) where kind = 'playlist';

