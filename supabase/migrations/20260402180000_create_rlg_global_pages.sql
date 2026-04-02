create extension if not exists pgcrypto;

create table if not exists public.rlg_global_pages (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique,
  locale text not null default '',
  title text not null default '',
  meta_description text,
  content_text text not null default '',
  content_hash text not null unique,
  source_kind text not null default 'rev-log',
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rlg_global_pages_locale_idx
  on public.rlg_global_pages (locale);

create index if not exists rlg_global_pages_imported_at_idx
  on public.rlg_global_pages (imported_at desc);

create index if not exists rlg_global_pages_updated_at_idx
  on public.rlg_global_pages (updated_at desc);

create or replace function public.set_rlg_global_pages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_rlg_global_pages_updated_at on public.rlg_global_pages;

create trigger trg_set_rlg_global_pages_updated_at
before update on public.rlg_global_pages
for each row execute function public.set_rlg_global_pages_updated_at();

alter table public.rlg_global_pages enable row level security;
