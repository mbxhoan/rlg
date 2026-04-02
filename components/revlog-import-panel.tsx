'use client';

import { useEffect, useState } from 'react';

type PageRecord = {
  source_url: string;
  locale: string;
  title: string;
  meta_description: string | null;
  content_text: string;
  imported_at: string;
  updated_at: string;
};

export function RevLogImportPanel() {
  const [urls, setUrls] = useState('');
  const [pages, setPages] = useState<PageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadPages();
  }, []);

  async function loadPages() {
    try {
      const response = await fetch('/api/knowledge/revlog');
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { pages?: PageRecord[] };
      setPages(payload.pages ?? []);
    } catch {
      // no-op
    }
  }

  async function importPages() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/knowledge/revlog/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: urls
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Không thể import.');
      }

      const payload = (await response.json()) as { pages?: PageRecord[] };
      setMessage(`Đã import ${payload.pages?.length ?? 0} trang.`);
      setUrls('');
      await loadPages();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể import.');
    } finally {
      setLoading(false);
    }
  }

  async function importSeed() {
    setUrls('');
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/knowledge/revlog/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Không thể import seed URLs.');
      }

      const payload = (await response.json()) as { pages?: PageRecord[] };
      setMessage(`Đã import ${payload.pages?.length ?? 0} trang seed.`);
      await loadPages();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể import seed URLs.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card workspace" style={{ marginTop: 20 }}>
      <div className="workspace-header">
        <div>
          <h2 className="panel-title" style={{ marginBottom: 4 }}>
            RLG Global Knowledge Import
          </h2>
          <p>
            Nhập URL từ rev-log.com để xây dựng kho nội dung global riêng cho agent, tách khỏi bài Facebook cũ.
          </p>
        </div>

        <div className="hero-actions">
          <button className="button" type="button" onClick={importSeed} disabled={loading}>
            Import seed
          </button>
          <button className="button primary" type="button" onClick={importPages} disabled={loading}>
            {loading ? 'Đang import...' : 'Import URL'}
          </button>
        </div>
      </div>

      <div className="field-grid">
        <div className="field span-2">
          <label htmlFor="revlog-urls">URLs từ rev-log.com</label>
          <textarea
            id="revlog-urls"
            className="textarea"
            style={{ minHeight: 150 }}
            value={urls}
            onChange={(event) => setUrls(event.target.value)}
            placeholder={"https://rev-log.com/\nhttps://rev-log.com/about-us/\nhttps://rev-log.com/rlg-by-reconomy-initiates-soft-relaunch-of-its-brand/"}
          />
        </div>
      </div>

      {message ? <p className="footer-note" style={{ color: 'var(--success)' }}>{message}</p> : null}
      {error ? <p className="footer-note" style={{ color: 'var(--danger)' }}>{error}</p> : null}

      <div className="list" style={{ maxHeight: 280, marginTop: 14 }}>
        {pages.map((page) => (
          <div key={page.source_url} className="post-card">
            <h3>{page.title}</h3>
            <p>{page.source_url}</p>
            <div className="meta-row">
              <span className="badge">{page.locale}</span>
              <span className="badge">Imported: {new Date(page.imported_at).toLocaleDateString('vi-VN')}</span>
            </div>
          </div>
        ))}

        {pages.length === 0 ? <div className="empty-state">Chưa import trang nào từ rev-log.com.</div> : null}
      </div>
    </section>
  );
}
