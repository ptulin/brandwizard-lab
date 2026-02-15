-- BrandWizard Lab – Supabase schema
-- Shared thread (global conversation)
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  author_display_name text not null,
  author_name_norm text not null,
  body text not null,
  type text not null default 'note' check (type in ('note', 'decision', 'question', 'action', 'file')),
  created_at timestamptz default now()
);

create index if not exists idx_entries_created_at on entries(created_at);

-- Async mail
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  to_name_norm text not null,
  from_display_name text not null,
  body text not null,
  created_at timestamptz default now(),
  delivered_at timestamptz
);

create index if not exists idx_messages_to_undelivered on messages(to_name_norm) where delivered_at is null;

-- Participants (optional, for name registry)
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  name_norm text unique not null,
  display_name text not null,
  created_at timestamptz default now()
);

-- RLS: allow all for V1 (anon key)
alter table entries enable row level security;
alter table messages enable row level security;
alter table participants enable row level security;

create policy "entries all" on entries for all using (true) with check (true);
create policy "messages all" on messages for all using (true) with check (true);
create policy "participants all" on participants for all using (true) with check (true);
