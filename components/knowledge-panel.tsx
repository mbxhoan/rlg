'use client';

import { useEffect, useState } from 'react';

type KnowledgeSearchResult = {
  document_id: string;
  chunk_id: string;
  source_table: 'facebook_posts' | 'website_pages';
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

type RebuildSummary = {
  documents_scanned: number;
  documents_upserted: number;
  documents_skipped: number;
  chunks_deleted: number;
  chunks_inserted: number;
  source_breakdown: Record<'facebook_posts' | 'website_pages', { scanned: number; upserted: number; skipped: number }>;
};

type KnowledgeContextPack = {
  query: string;
  limit: number;
  source_tables: Array<'facebook_posts' | 'website_pages'>;
  context_text: string;
  chunks: KnowledgeSearchResult[];
};

export function KnowledgePanel() {
  const [query, setQuery] = useState('EPR');
  const [limit, setLimit] = useState('5');
  const [contextLimit, setContextLimit] = useState('3');
  const [includeFacebook, setIncludeFacebook] = useState(true);
  const [includeWebPages, setIncludeWebPages] = useState(true);
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [contextPack, setContextPack] = useState<KnowledgeContextPack | null>(null);
  const [summary, setSummary] = useState<RebuildSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void runSearch();
  }, []);

  async function runSearch() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const params = new URLSearchParams();
      params.set('q', query.trim());
      params.set('limit', limit || '5');
      const sources = getSelectedSources();
      if (sources.length > 0) {
        params.set('sources', sources.join(','));
      }

      const response = await fetch(`/api/knowledge/search?${params.toString()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Không thể tìm knowledge.');
      }

      const payload = (await response.json()) as { results?: KnowledgeSearchResult[] };
      setResults(payload.results ?? []);
      setMessage(`Đã tìm ${payload.results?.length ?? 0} chunk phù hợp.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể tìm knowledge.');
    } finally {
      setLoading(false);
    }
  }

  async function buildContext() {
    setContextLoading(true);
    setError(null);
    setMessage(null);

    try {
      const params = new URLSearchParams();
      params.set('q', query.trim());
      params.set('limit', contextLimit || '3');
      const sources = getSelectedSources();
      if (sources.length > 0) {
        params.set('sources', sources.join(','));
      }

      const response = await fetch(`/api/knowledge/context?${params.toString()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Không thể build context.');
      }

      const payload = (await response.json()) as { pack?: KnowledgeContextPack };
      setContextPack(payload.pack ?? null);
      setMessage(`Đã build context pack ${payload.pack?.chunks.length ?? 0} chunk.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể build context.');
    } finally {
      setContextLoading(false);
    }
  }

  async function rebuildIndex() {
    setRebuilding(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/knowledge/rebuild', { method: 'POST' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Không thể rebuild index.');
      }

      const payload = (await response.json()) as { summary?: RebuildSummary };
      setSummary(payload.summary ?? null);
      setMessage('Đã rebuild knowledge index.');
      await runSearch();
      await buildContext();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể rebuild index.');
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <section className="card workspace" style={{ marginTop: 20 }}>
      <div className="workspace-header">
        <div>
          <h2 className="panel-title" style={{ marginBottom: 4 }}>
            Knowledge Index
          </h2>
          <p>
            Rebuild chunk index từ <code>facebook_posts</code> và <code>website_pages</code>, rồi test retrieval trực tiếp.
          </p>
        </div>

        <div className="hero-actions">
          <button className="button primary" type="button" onClick={rebuildIndex} disabled={rebuilding}>
            {rebuilding ? 'Đang rebuild...' : 'Rebuild index'}
          </button>
          <button className="button" type="button" onClick={runSearch} disabled={loading}>
            {loading ? 'Đang search...' : 'Search'}
          </button>
          <button className="button" type="button" onClick={buildContext} disabled={contextLoading}>
            {contextLoading ? 'Đang build...' : 'Build context'}
          </button>
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="knowledge-query">Query</label>
          <input
            id="knowledge-query"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="EPR, PRO, recycling, packaging..."
          />
        </div>
        <div className="field">
          <label htmlFor="knowledge-limit">Limit</label>
          <input
            id="knowledge-limit"
            className="input"
            inputMode="numeric"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            placeholder="5"
          />
        </div>
        <div className="field">
          <label htmlFor="context-limit">Context limit</label>
          <input
            id="context-limit"
            className="input"
            inputMode="numeric"
            value={contextLimit}
            onChange={(event) => setContextLimit(event.target.value)}
            placeholder="3"
          />
        </div>
        <div className="field">
          <label>Sources</label>
          <div className="meta-row" style={{ marginTop: 0 }}>
            <label className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={includeFacebook}
                onChange={(event) => setIncludeFacebook(event.target.checked)}
              />
              facebook_posts
            </label>
            <label className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={includeWebPages}
                onChange={(event) => setIncludeWebPages(event.target.checked)}
              />
              website_pages
            </label>
          </div>
        </div>
      </div>

      {message ? <p className="footer-note" style={{ color: 'var(--success)' }}>{message}</p> : null}
      {error ? <p className="footer-note" style={{ color: 'var(--danger)' }}>{error}</p> : null}

      {summary ? (
        <div className="card" style={{ padding: 14, background: 'rgba(255,255,255,0.02)', marginTop: 10 }}>
          <div className="meta-row" style={{ marginTop: 0 }}>
            <span className="badge">Scanned: {summary.documents_scanned}</span>
            <span className="badge">Upserted: {summary.documents_upserted}</span>
            <span className="badge">Skipped: {summary.documents_skipped}</span>
            <span className="badge">Chunks: {summary.chunks_inserted}</span>
          </div>
          <p className="footer-note" style={{ marginTop: 10 }}>
            facebook_posts: {summary.source_breakdown.facebook_posts.upserted}/{summary.source_breakdown.facebook_posts.scanned} | website_pages: {summary.source_breakdown.website_pages.upserted}/{summary.source_breakdown.website_pages.scanned}
          </p>
        </div>
      ) : null}

      {contextPack ? (
        <div className="card" style={{ padding: 14, background: 'rgba(255,255,255,0.02)', marginTop: 14 }}>
          <div className="workspace-header" style={{ alignItems: 'center' }}>
            <div>
              <h3 className="panel-title" style={{ marginBottom: 4 }}>
                Context Pack
              </h3>
              <p>Top {contextPack.chunks.length} chunk cho query: <strong>{contextPack.query}</strong></p>
            </div>
            <button
              className="button"
              type="button"
              onClick={async () => {
                if (!contextPack.context_text) return;
                await navigator.clipboard.writeText(contextPack.context_text);
                setMessage('Đã copy context pack.');
              }}
              disabled={!contextPack.context_text}
            >
              Copy context
            </button>
          </div>

          <div className="meta-row" style={{ marginTop: 0 }}>
            <span className="badge">limit {contextPack.limit}</span>
            {contextPack.source_tables.map((source) => (
              <span key={source} className="badge">{source}</span>
            ))}
          </div>

          <pre
            className="textarea"
            style={{ marginTop: 12, minHeight: 220, whiteSpace: 'pre-wrap', overflow: 'auto' }}
          >
            {contextPack.context_text || 'Không có chunk phù hợp.'}
          </pre>
        </div>
      ) : null}

      <div className="list" style={{ maxHeight: 340, marginTop: 14 }}>
        {results.map((result) => (
          <article key={result.chunk_id} className="post-card">
            <div className="meta-row" style={{ marginTop: 0 }}>
              <span className="badge">{result.source_table}</span>
              <span className="badge">{result.locale}</span>
              <span className="badge">{result.content_type}</span>
              <span className="badge">rank {result.rank.toFixed(2)}</span>
            </div>
            <h3 style={{ marginTop: 10 }}>{result.title}</h3>
            <p style={{ opacity: 0.8, marginTop: 6 }}>{result.source_url ?? result.source_id}</p>
            <p style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{result.chunk_text.slice(0, 360)}{result.chunk_text.length > 360 ? '...' : ''}</p>
          </article>
        ))}

        {results.length === 0 ? <div className="empty-state">Chưa có kết quả. Hãy chạy rebuild rồi search lại.</div> : null}
      </div>
    </section>
  );

  function getSelectedSources(): Array<'facebook_posts' | 'website_pages'> {
    const sources: Array<'facebook_posts' | 'website_pages'> = [];
    if (includeFacebook) sources.push('facebook_posts');
    if (includeWebPages) sources.push('website_pages');
    return sources;
  }
}
