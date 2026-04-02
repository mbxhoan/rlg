import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type KnowledgeSourceTable = 'facebook_posts' | 'web_pages';

export type KnowledgeDocument = {
  source_table: KnowledgeSourceTable;
  source_id: string;
  source_url: string | null;
  title: string;
  locale: string;
  content_type: string;
  content: string;
  content_hash: string;
  metadata: Record<string, unknown>;
  source_updated_at: string | null;
};

type KnowledgeDocumentInput = Omit<KnowledgeDocument, 'content_hash'>;

export type KnowledgeChunk = {
  chunk_index: number;
  chunk_text: string;
  chunk_hash: string;
  token_count: number;
  metadata: Record<string, unknown>;
};

export type KnowledgeSearchResult = {
  document_id: string;
  chunk_id: string;
  source_table: KnowledgeSourceTable;
  source_id: string;
  source_url: string | null;
  title: string;
  locale: string;
  content_type: string;
  chunk_index: number;
  token_count: number;
  chunk_text: string;
  rank: number;
};

export type KnowledgeRebuildSummary = {
  documents_scanned: number;
  documents_upserted: number;
  documents_skipped: number;
  chunks_deleted: number;
  chunks_inserted: number;
  source_breakdown: Record<KnowledgeSourceTable, { scanned: number; upserted: number; skipped: number }>;
};

type RagDocumentRow = {
  id: string;
  source_table: KnowledgeSourceTable;
  source_id: string;
  content_hash: string;
  title: string;
  locale: string;
  content_type: string;
  source_url: string | null;
  source_updated_at: string | null;
};

const SOURCE_TABLES: KnowledgeSourceTable[] = ['facebook_posts', 'web_pages'];
const FACEBOOK_CHUNK_TARGET_WORDS = 280;
const WEB_PAGE_CHUNK_TARGET_WORDS = 520;
const CHUNK_OVERLAP_WORDS = 80;
const BATCH_SIZE = 500;

export async function rebuildKnowledgeIndex() {
  const existingDocuments = await loadExistingDocuments();
  const summary: KnowledgeRebuildSummary = {
    documents_scanned: 0,
    documents_upserted: 0,
    documents_skipped: 0,
    chunks_deleted: 0,
    chunks_inserted: 0,
    source_breakdown: {
      facebook_posts: { scanned: 0, upserted: 0, skipped: 0 },
      web_pages: { scanned: 0, upserted: 0, skipped: 0 },
    },
  };

  for (const sourceTable of SOURCE_TABLES) {
    const sourceDocuments = await loadSourceDocuments(sourceTable);

    for (const document of sourceDocuments) {
      summary.documents_scanned += 1;
      summary.source_breakdown[sourceTable].scanned += 1;

      const existing = existingDocuments.get(makeDocumentKey(document.source_table, document.source_id));
      if (existing && existing.content_hash === document.content_hash) {
        summary.documents_skipped += 1;
        summary.source_breakdown[sourceTable].skipped += 1;
        continue;
      }

      const { data: savedDocument, error: saveError } = await supabaseAdmin
        .from('rag_documents')
        .upsert(
          {
            source_table: document.source_table,
            source_id: document.source_id,
            source_url: document.source_url,
            title: document.title,
            locale: document.locale,
            content_type: document.content_type,
            content: document.content,
            content_hash: document.content_hash,
            metadata: document.metadata,
            active: true,
            source_updated_at: document.source_updated_at,
          },
          { onConflict: 'source_table,source_id' }
        )
        .select('id,source_table,source_id,content_hash,title,locale,content_type,source_url,source_updated_at')
        .single();

      if (saveError) {
        throw new Error(`Failed to upsert ${sourceTable}:${document.source_id} - ${saveError.message}`);
      }

      const saved = savedDocument as RagDocumentRow;
      const chunkDelete = await supabaseAdmin
        .from('rag_chunks')
        .delete()
        .eq('document_id', saved.id)
        .select('id');
      if (chunkDelete.error) {
        throw new Error(`Failed to clear chunks for ${sourceTable}:${document.source_id} - ${chunkDelete.error.message}`);
      }

      summary.chunks_deleted += chunkDelete.data?.length ?? 0;

      const chunks = chunkDocument(document);
      if (chunks.length > 0) {
        const { error: insertError } = await supabaseAdmin.from('rag_chunks').insert(
          chunks.map((chunk) => ({
            document_id: saved.id,
            chunk_index: chunk.chunk_index,
            chunk_text: chunk.chunk_text,
            chunk_hash: chunk.chunk_hash,
            token_count: chunk.token_count,
            metadata: chunk.metadata,
            active: true,
          }))
        );

        if (insertError) {
          throw new Error(`Failed to insert chunks for ${sourceTable}:${document.source_id} - ${insertError.message}`);
        }

        summary.chunks_inserted += chunks.length;
      }

      summary.documents_upserted += 1;
      summary.source_breakdown[sourceTable].upserted += 1;
    }
  }

  return summary;
}

export async function searchKnowledgeChunks(params: {
  query: string;
  limit?: number;
  sourceTables?: KnowledgeSourceTable[];
}): Promise<KnowledgeSearchResult[]> {
  const limit = Math.max(1, Math.min(params.limit ?? 8, 20));
  const { data, error } = await supabaseAdmin.rpc('search_rag_chunks', {
    query_text: params.query,
    result_limit: limit,
    source_tables: params.sourceTables?.length ? params.sourceTables : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as KnowledgeSearchResult[];
}

export async function getKnowledgeIndexStats() {
  const [documentsResult, chunksResult] = await Promise.all([
    supabaseAdmin.from('rag_documents').select('id,source_table', { count: 'exact', head: true }),
    supabaseAdmin.from('rag_chunks').select('id', { count: 'exact', head: true }),
  ]);

  if (documentsResult.error) {
    throw new Error(documentsResult.error.message);
  }

  if (chunksResult.error) {
    throw new Error(chunksResult.error.message);
  }

  return {
    documents: documentsResult.count ?? 0,
    chunks: chunksResult.count ?? 0,
  };
}

async function loadExistingDocuments() {
  const { data, error } = await supabaseAdmin
    .from('rag_documents')
    .select('id,source_table,source_id,content_hash,title,locale,content_type,source_url,source_updated_at');

  if (error) {
    throw new Error(error.message);
  }

  const documents = new Map<string, RagDocumentRow>();
  for (const row of data ?? []) {
    const document = row as RagDocumentRow;
    documents.set(makeDocumentKey(document.source_table, document.source_id), document);
  }
  return documents;
}

async function loadSourceDocuments(sourceTable: KnowledgeSourceTable): Promise<KnowledgeDocument[]> {
  const rows =
    sourceTable === 'facebook_posts'
      ? await loadFacebookPosts()
      : await loadWebPages();

  return rows;
}

async function loadFacebookPosts(): Promise<KnowledgeDocument[]> {
  const rows = await fetchAllRows('facebook_posts', 'post_id,date,content,post_url,images,created_at');
  return rows
    .map((row) => {
      const postId = readText(row, ['post_id']);
      const content = readText(row, ['content']);
      if (!postId || !content) return null;

      const title = firstLine(content) || postId;
      const postUrl = nullableText(row, ['post_url']);
      const createdAt = nullableText(row, ['created_at']);
      const date = nullableText(row, ['date']);

      return makeDocument({
        source_table: 'facebook_posts',
        source_id: postId,
        source_url: postUrl,
        title,
        locale: 'bilingual',
        content_type: 'facebook_post',
        content,
        metadata: {
          date,
          images: Array.isArray((row as Record<string, unknown>).images) ? (row as Record<string, unknown>).images : [],
        },
        source_updated_at: createdAt ?? date,
      });
    })
    .filter((document): document is KnowledgeDocument => document !== null);
}

async function loadWebPages(): Promise<KnowledgeDocument[]> {
  const rows = await fetchAllRows('web_pages', '*');
  return rows
    .map((row) => {
      const sourceId =
        readText(row, ['page_id', 'id', 'slug', 'source_id']) ||
        readText(row, ['url', 'source_url']) ||
        stableHash(JSON.stringify(row)).slice(0, 16);

      const content = readText(row, ['content', 'content_text', 'body', 'markdown', 'text']);
      if (!sourceId || !content) return null;

      const title =
        readText(row, ['title', 'name', 'page_title']) ||
        firstLine(content) ||
        sourceId;
      const sourceUrl = nullableText(row, ['url', 'source_url', 'canonical_url', 'permalink']);
      const locale =
        readText(row, ['locale']) ||
        inferLocaleFromUrl(sourceUrl ?? '') ||
        'global';
      const contentType = readText(row, ['content_type', 'type']) || 'web_page';
      const createdAt = nullableText(row, ['created_at', 'updated_at', 'published_at']);

      return makeDocument({
        source_table: 'web_pages',
        source_id: sourceId,
        source_url: sourceUrl,
        title,
        locale,
        content_type: contentType,
        content,
        metadata: pickMetadata(row, ['description', 'meta_description', 'excerpt', 'keywords']),
        source_updated_at: createdAt,
      });
    })
    .filter((document): document is KnowledgeDocument => document !== null);
}

async function fetchAllRows(table: string, columns: string) {
  const out: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabaseAdmin.from(table).select(columns).range(from, from + BATCH_SIZE - 1);

    if (error) {
      throw new Error(`Failed to read ${table}: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    out.push(...rows);

    if (rows.length < BATCH_SIZE) {
      break;
    }

    from += BATCH_SIZE;
  }

  return out;
}

function makeDocument(input: KnowledgeDocumentInput): KnowledgeDocument {
  return {
    ...input,
    content: normalizeContent(input.content),
    content_hash: stableHash(
      [
        input.source_table,
        input.source_id,
        input.source_url ?? '',
        input.title,
        input.locale,
        input.content_type,
        normalizeContent(input.content),
      ].join('\n')
    ),
  };
}

function chunkDocument(document: KnowledgeDocument): KnowledgeChunk[] {
  const targetWords = document.source_table === 'facebook_posts' ? FACEBOOK_CHUNK_TARGET_WORDS : WEB_PAGE_CHUNK_TARGET_WORDS;
  const blocks = splitIntoBlocks(document.content);
  if (blocks.length === 0) return [];

  const chunks: KnowledgeChunk[] = [];
  let chunkBlocks: string[] = [];
  let chunkWords = 0;

  const flush = () => {
    const text = chunkBlocks.join('\n\n').trim();
    if (!text) {
      chunkBlocks = [];
      chunkWords = 0;
      return;
    }

    const chunkIndex = chunks.length;
    chunks.push({
      chunk_index: chunkIndex,
      chunk_text: text,
      chunk_hash: stableHash([document.source_table, document.source_id, chunkIndex, text].join('\n')),
      token_count: countWords(text),
      metadata: {
        source_table: document.source_table,
        source_id: document.source_id,
        title: document.title,
        locale: document.locale,
      },
    });

    const overlap = takeOverlapBlocks(chunkBlocks, CHUNK_OVERLAP_WORDS);
    chunkBlocks = overlap;
    chunkWords = countWords(chunkBlocks.join('\n\n'));
  };

  for (const block of blocks) {
    const blockWords = countWords(block);
    if (chunkBlocks.length > 0 && chunkWords + blockWords > targetWords) {
      flush();
    }

    chunkBlocks.push(block);
    chunkWords += blockWords;
  }

  if (chunkBlocks.length > 0) {
    flush();
  }

  return chunks;
}

function splitIntoBlocks(content: string) {
  const normalized = normalizeContent(content);
  if (!normalized) return [];

  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => block.replace(/\n{3,}/g, '\n\n'));
}

function takeOverlapBlocks(blocks: string[], overlapWords: number) {
  const overlap: string[] = [];
  let totalWords = 0;

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    overlap.unshift(blocks[index]);
    totalWords += countWords(blocks[index]);
    if (totalWords >= overlapWords) {
      break;
    }
  }

  return overlap;
}

function pickMetadata(row: Record<string, unknown>, keys: string[]) {
  const metadata: Record<string, unknown> = {};
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') {
      metadata[key] = value;
    }
  }
  return metadata;
}

function readText(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }
  return '';
}

function nullableText(row: Record<string, unknown>, keys: string[]) {
  const value = readText(row, keys);
  return value.length > 0 ? value : null;
}

function normalizeContent(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
}

function countWords(value: string) {
  return normalizeContent(value)
    .split(/\s+/)
    .filter(Boolean).length;
}

function firstLine(content: string) {
  return normalizeContent(content)
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 180) ?? '';
}

function makeDocumentKey(sourceTable: KnowledgeSourceTable, sourceId: string) {
  return `${sourceTable}:${sourceId}`;
}

function stableHash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function inferLocaleFromUrl(url: string) {
  const pathname = url.toLowerCase();
  if (pathname.includes('/vi/')) return 'vi';
  if (pathname.includes('/en/')) return 'en';
  return 'global';
}
