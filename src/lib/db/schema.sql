-- marginalia schema. PRD §4.3.
--
-- Supabase-compatible: this is plain Postgres and the connection string is the
-- only difference between a local instance and a Supabase project. pgvector is
-- optional — the embedding column is added only where the extension exists, and
-- v1's related-notes panel is keyword-based regardless (PRD §6.5).
--
-- Files are truth for anything that is knowledge. This database holds only the
-- relationship to that knowledge. Dropping it loses zero notes.

create table if not exists sources (
  id              text primary key,
  url             text not null unique,
  title           text not null,
  author          text,
  site            text,
  source_type     text not null default 'article',
  saved_at        timestamptz not null default now(),
  read_at         timestamptz,
  status          text not null default 'unread'
                    check (status in ('unread','reading','ready','processing','processed','archived')),
  inbox_path      text,
  favicon         text,
  reader_html_key text,
  word_count      integer,
  tags            text[] not null default '{}'
);

create table if not exists highlights (
  id            text primary key,
  source_id     text not null references sources(id) on delete cascade,
  text          text not null,
  prefix        text not null default '',
  suffix        text not null default '',
  position_hint integer,
  color         text not null default 'yellow'
                  check (color in ('yellow','green','blue','pink')),
  note          text,
  created_at    timestamptz not null default now(),
  inbox_anchor  text
);
create index if not exists highlights_source_idx on highlights(source_id, created_at);

create table if not exists captures (
  id         text primary key,
  source_id  text not null references sources(id) on delete cascade,
  raw_text   text not null,
  created_at timestamptz not null default now(),
  status     text not null default 'pending'
               check (status in ('pending','processing','processed','discarded'))
);
create index if not exists captures_source_idx on captures(source_id);

create table if not exists proposals (
  id                  text primary key,
  source_id           text not null references sources(id) on delete cascade,
  run_id              text not null,
  action              text not null,
  payload             jsonb not null,
  rationale           text,
  confidence          real,
  status              text not null default 'pending'
                        check (status in ('pending','accepted','rejected','edited')),
  decided_at          timestamptz,
  resulting_note_path text,
  created_at          timestamptz not null default now()
);
create index if not exists proposals_source_idx on proposals(source_id, created_at desc);

-- Derived cache of the vault. Never a second copy of it: paths and metadata
-- only, no note bodies. Safe to truncate and regenerate at any time.
create table if not exists note_index (
  path         text primary key,
  title        text not null,
  folder       text,
  slug         text not null,
  type         text not null,
  tags         text[] not null default '{}',
  content_hash text not null,
  created_at   timestamptz,
  updated_at   timestamptz
);

create table if not exists reviews (
  note_path     text primary key,
  last_reviewed timestamptz,
  next_due      timestamptz,
  ease          real not null default 2.5,
  streak        integer not null default 0
);
