create extension if not exists vector with schema extensions;

alter table public.rag_documents
  add column if not exists fts tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) stored;

alter table public.rag_chunks
  add column if not exists fts tsvector generated always as (
    to_tsvector('simple', coalesce(chunk_text, ''))
  ) stored;

alter table public.rag_chunks
  add column if not exists embedding extensions.vector(1536);

alter table public.rag_chunks
  add column if not exists embedding_model text;

alter table public.rag_chunks
  add column if not exists embedded_at timestamptz;

create index if not exists rag_documents_fts_idx
  on public.rag_documents using gin (fts);

create index if not exists rag_chunks_fts_idx
  on public.rag_chunks using gin (fts);

create index if not exists rag_chunks_embedding_idx
  on public.rag_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100)
  where embedding is not null;

create or replace function public.search_rag_chunks_hybrid(
  query_text text,
  query_embedding text default null,
  result_limit integer default 8,
  source_tables text[] default null,
  full_text_weight float default 1,
  semantic_weight float default 1,
  rrf_k integer default 50
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
  with params as (
    select
      nullif(query_text, '') as qtext,
      case
        when query_embedding is null or btrim(query_embedding) = '' then null
        else query_embedding::extensions.vector(1536)
      end as qembedding
  ),
  full_text as (
    select
      c.id as chunk_id,
      row_number() over (
        order by ts_rank_cd(c.fts, websearch_to_tsquery('simple', p.qtext)) desc, d.updated_at desc, c.chunk_index asc
      ) as rank_ix
    from public.rag_chunks c
    join public.rag_documents d on d.id = c.document_id
    cross join params p
    where d.active
      and c.active
      and (
        source_tables is null
        or d.source_table = any(source_tables)
      )
      and p.qtext is not null
      and c.fts @@ websearch_to_tsquery('simple', p.qtext)
    order by ts_rank_cd(c.fts, websearch_to_tsquery('simple', p.qtext)) desc, d.updated_at desc, c.chunk_index asc
    limit greatest(result_limit * 5, 20)
  ),
  semantic as (
    select
      c.id as chunk_id,
      row_number() over (
        order by (c.embedding <=> p.qembedding) asc, d.updated_at desc, c.chunk_index asc
      ) as rank_ix
    from public.rag_chunks c
    join public.rag_documents d on d.id = c.document_id
    cross join params p
    where d.active
      and c.active
      and (
        source_tables is null
        or d.source_table = any(source_tables)
      )
      and p.qembedding is not null
      and c.embedding is not null
    order by (c.embedding <=> p.qembedding) asc, d.updated_at desc, c.chunk_index asc
    limit greatest(result_limit * 5, 20)
  ),
  combined as (
    select
      coalesce(ft.chunk_id, sem.chunk_id) as chunk_id,
      ft.rank_ix as full_text_rank_ix,
      sem.rank_ix as semantic_rank_ix
    from full_text ft
    full outer join semantic sem using (chunk_id)
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
    (
      coalesce(full_text_weight / (rrf_k + combined.full_text_rank_ix), 0)
      +
      coalesce(semantic_weight / (rrf_k + combined.semantic_rank_ix), 0)
    )::real as rank
  from combined
  join public.rag_chunks c on c.id = combined.chunk_id
  join public.rag_documents d on d.id = c.document_id
  order by rank desc, d.updated_at desc, c.chunk_index asc
  limit greatest(1, coalesce(result_limit, 8));
$$;
