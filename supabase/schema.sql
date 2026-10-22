-- Supabase schema mirroring src/lib/types.ts. Photos go in the `event-photos` storage bucket.
create table events (
  id text primary key,
  name text not null,
  venue text,
  starts_at timestamptz,
  ends_at timestamptz,
  hashtag text,
  organiser_handle text,
  prizes jsonb default '[]'
);

create table attendees (
  id text primary key,
  event_id text references events(id) on delete cascade,
  auth_user_id uuid references auth.users(id),
  name text not null,
  x_handle text not null,
  linkedin text,
  look_for text,
  color text,
  followers_x int default 0,
  followers_linkedin int default 0,
  consent_photo boolean not null default false,
  consent_tag boolean not null default false,
  role text default 'attendee',
  joined_at timestamptz default now(),
  unique (event_id, x_handle)
);

create table photos (
  id text primary key,
  event_id text references events(id) on delete cascade,
  storage_path text not null,
  uploader_id text references attendees(id),
  caption text,
  taken_at timestamptz,
  uploaded_at timestamptz default now(),
  status text default 'pending',
  tags jsonb default '[]',
  withheld jsonb default '[]',
  hidden boolean default false,
  grok_note text
);

create table share_tasks (
  id text primary key,
  event_id text references events(id) on delete cascade,
  attendee_id text references attendees(id),
  type text check (type in ('post', 'comment', 'repost')),
  platform text check (platform in ('x', 'linkedin')),
  scheduled_at timestamptz,
  photo_id text references photos(id),
  target_task_id text references share_tasks(id),
  copy text,
  why text,
  status text default 'todo',
  done_at timestamptz
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete cascade,
  at timestamptz default now(),
  kind text,
  text text,
  attendee_id text references attendees(id)
);

alter table attendees enable row level security;
create policy "attendees edit own consent" on attendees
  for update using (auth.uid() = auth_user_id);
