create extension if not exists pgcrypto;

create table if not exists public.facebook_posts_workspace (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content text not null default '',
  status text not null default 'draft',
  published_on date,
  published_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists facebook_posts_workspace_status_idx
  on public.facebook_posts_workspace (status);

create index if not exists facebook_posts_workspace_created_at_idx
  on public.facebook_posts_workspace (created_at desc);

create index if not exists facebook_posts_workspace_updated_at_idx
  on public.facebook_posts_workspace (updated_at desc);

create or replace function public.set_facebook_posts_workspace_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_facebook_posts_workspace_updated_at on public.facebook_posts_workspace;

create trigger trg_set_facebook_posts_workspace_updated_at
before update on public.facebook_posts_workspace
for each row execute function public.set_facebook_posts_workspace_updated_at();

alter table public.facebook_posts_workspace enable row level security;
