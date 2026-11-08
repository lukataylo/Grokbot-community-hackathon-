-- Lumzel schema. Idempotent: applied at boot.
create extension if not exists pgcrypto;

create table if not exists hosts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists login_tokens (
  token_hash text primary key,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  host_id uuid not null references hosts(id) on delete cascade,
  name text not null,
  hosted_by text not null default '',
  venue text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Europe/London',
  expected_guests int not null default 100,
  deliver_at timestamptz not null,
  linkedin_handle text not null default '',
  x_handle text not null default '',
  hashtag text not null default '',
  caption_template text not null default '',
  description text not null default '',
  highlights text not null default '',
  review_mode text not null default 'host_then_auto',
  uploads text not null default 'everyone',
  retention_days int not null default 30,
  sharing_unlocked boolean not null default false,
  paid_at timestamptz,
  amount_paid int,
  currency text,
  stripe_session_id text,
  delivered_at timestamptz,
  roundups_sent int not null default 0,
  last_roundup_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists events_host on events(host_id);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  email text,
  choice text check (choice in ('show','cover')),
  taggable boolean not null default false,
  embedding real[],
  resume_code text not null unique,
  push jsonb,
  prefs jsonb not null default '{"post":true,"roundup":true,"likes":true,"host":false}',
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists guests_event on guests(event_id);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  guest_id uuid references guests(id) on delete set null,
  by_host boolean not null default false,
  original_key text not null,
  public_key text,
  width int, height int,
  status text not null default 'processing',
  regions jsonb not null default '[]',
  tiled_count int not null default 0,
  model_count int,
  needs_review boolean not null default false,
  reviewed_at timestamptz,
  render_rev int not null default 0,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists photos_event on photos(event_id, created_at desc);

create table if not exists photo_people (
  photo_id uuid not null references photos(id) on delete cascade,
  guest_id uuid not null references guests(id) on delete cascade,
  primary key (photo_id, guest_id)
);
create index if not exists photo_people_guest on photo_people(guest_id);

create table if not exists shares (
  code text primary key,
  event_id uuid not null references events(id) on delete cascade,
  guest_id uuid not null references guests(id) on delete cascade,
  photo_id uuid not null references photos(id) on delete cascade,
  platform text not null,
  caption text not null default '',
  clicks int not null default 0,
  previews int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists shares_event on shares(event_id);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  guest_id uuid not null references guests(id) on delete cascade,
  photo_id uuid references photos(id) on delete set null,
  share_code text references shares(code) on delete set null,
  url text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  unique (event_id, url)
);

create table if not exists cheers (
  post_id uuid not null references posts(id) on delete cascade,
  guest_id uuid not null references guests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, guest_id)
);

create table if not exists caption_cache (
  photo_id uuid primary key references photos(id) on delete cascade,
  scene text not null,
  created_at timestamptz not null default now()
);
