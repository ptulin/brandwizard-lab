-- BrandWizard Lab – Supabase schema (optional; app works with in-memory store until wired)
-- Run in Supabase SQL Editor after creating a project.

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  name_norm text unique not null,
  display_name text not null,
  created_at timestamptz default now()
);

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  author_display_name text not null,
  author_name_norm text not null,
  body text not null,
  type text not null default 'note' check (type in ('note', 'decision', 'question', 'action')),
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
