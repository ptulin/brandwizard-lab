-- Document storage: who uploaded what, view all uploads
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
create policy "uploads all" on uploads for all using (true) with check (true);
