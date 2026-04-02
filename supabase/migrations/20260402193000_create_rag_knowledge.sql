create extension if not exists pgcrypto;

create table if not exists public.rag_documents (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id text not null,
  source_url text,
  title text not null,
  locale text not null default 'global',
  content_type text not null default 'page',
  content text not null,
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  source_updated_at timestamptz,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_table, source_id)
);

create index if not exists rag_documents_source_table_active_idx
  on public.rag_documents (source_table, active, updated_at desc);

create index if not exists rag_documents_source_id_idx
  on public.rag_documents (source_id);

create index if not exists rag_documents_search_idx
  on public.rag_documents using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '')));

create table if not exists public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.rag_documents(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  chunk_hash text not null,
  token_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists rag_chunks_document_id_idx
  on public.rag_chunks (document_id, chunk_index);

create index if not exists rag_chunks_active_idx
  on public.rag_chunks (active, updated_at desc);

create index if not exists rag_chunks_search_idx
  on public.rag_chunks using gin (to_tsvector('simple', coalesce(chunk_text, '')));

create or replace function public.set_rag_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_rag_documents_updated_at on public.rag_documents;

create trigger trg_set_rag_documents_updated_at
before update on public.rag_documents
for each row execute function public.set_rag_documents_updated_at();

create or replace function public.set_rag_chunks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_rag_chunks_updated_at on public.rag_chunks;

create trigger trg_set_rag_chunks_updated_at
before update on public.rag_chunks
for each row execute function public.set_rag_chunks_updated_at();

create or replace function public.search_rag_chunks(
  query_text text,
  result_limit integer default 8,
  source_tables text[] default null
)
returns table (
  document_id uuid,
  chunk_id uuid,
  source_table text,
  source_id text,
  source_url text,
  title text,
  locale text,
  content_type text,
  chunk_index integer,
  token_count integer,
  chunk_text text,
  rank real
)
language sql
stable
as $$
  with q as (
    select websearch_to_tsquery('simple', coalesce(query_text, '')) as tsq
  )
  select
    d.id as document_id,
    c.id as chunk_id,
    d.source_table,
    d.source_id,
    d.source_url,
    d.title,
    d.locale,
    d.content_type,
    c.chunk_index,
    c.token_count,
    c.chunk_text,
    ts_rank_cd(
      to_tsvector('simple', coalesce(c.chunk_text, '') || ' ' || coalesce(d.title, '') || ' ' || coalesce(d.content, '')),
      q.tsq
    )::real as rank
  from public.rag_chunks c
  join public.rag_documents d on d.id = c.document_id
  cross join q
  where d.active
    and c.active
    and (
      source_tables is null
      or d.source_table = any(source_tables)
    )
    and (
      coalesce(query_text, '') = ''
      or to_tsvector('simple', coalesce(c.chunk_text, '') || ' ' || coalesce(d.title, '') || ' ' || coalesce(d.content, '')) @@ q.tsq
    )
  order by
    case when coalesce(query_text, '') = '' then d.updated_at end desc,
    rank desc,
    d.updated_at desc,
    c.chunk_index asc
  limit greatest(1, coalesce(result_limit, 8));
$$;

alter table public.rag_documents enable row level security;
alter table public.rag_chunks enable row level security;
