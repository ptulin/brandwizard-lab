-- Copy this entire file into Supabase → SQL Editor → Run.

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  author_display_name text not null,
  author_name_norm text not null,
  body text not null,
  type text not null default 'note' check (type in ('note', 'decision', 'question', 'action', 'file')),
  created_at timestamptz default now()
);
create index if not exists idx_entries_created_at on entries(created_at);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  to_name_norm text not null,
  from_display_name text not null,
  body text not null,
  created_at timestamptz default now(),
  delivered_at timestamptz
);
create index if not exists idx_messages_to_undelivered on messages(to_name_norm) where delivered_at is null;

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  name_norm text unique not null,
  display_name text not null,
  created_at timestamptz default now()
);

alter table entries enable row level security;
alter table messages enable row level security;
alter table participants enable row level security;
drop policy if exists "entries all" on entries;
drop policy if exists "messages all" on messages;
drop policy if exists "participants all" on participants;
create policy "entries all" on entries for all using (true) with check (true);
create policy "messages all" on messages for all using (true) with check (true);
create policy "participants all" on participants for all using (true) with check (true);

-- Document storage: who uploaded what
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  uploader_display_name text not null,
  uploader_name_norm text not null,
  kind text not null check (kind in ('file', 'link', 'screenshot')),
  url text not null,
  title text,
  filename text,
  entry_id uuid references entries(id),
  created_at timestamptz default now()
);
create index if not exists idx_uploads_created_at on uploads(created_at desc);
create index if not exists idx_uploads_uploader on uploads(uploader_name_norm);
alter table uploads enable row level security;
drop policy if exists "uploads all" on uploads;
create policy "uploads all" on uploads for all using (true) with check (true);

-- Storage bucket (app auto-creates with service role key; run this if uploads fail)
insert into storage.buckets (id, name, public)
values ('lab-files', 'lab-files', true)
on conflict (id) do update set public = true;
drop policy if exists "lab-files insert" on storage.objects;
drop policy if exists "lab-files select" on storage.objects;
create policy "lab-files insert" on storage.objects for insert to public with check (bucket_id = 'lab-files');
create policy "lab-files select" on storage.objects for select to public using (bucket_id = 'lab-files');
