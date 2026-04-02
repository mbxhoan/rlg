'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PostStatus, WorkspacePost, WorkspacePostForm } from '@/lib/types';

type PostsResponse = {
  posts: WorkspacePost[];
};

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

type KnowledgeContextPack = {
  query: string;
  limit: number;
  source_tables: Array<'facebook_posts' | 'website_pages'>;
  context_text: string;
  chunks: KnowledgeSearchResult[];
};

const emptyForm: WorkspacePostForm = {
  title: '',
  content: '',
  status: 'draft',
  published_on: '',
  published_url: '',
  notes: '',
};

const statusLabels: Record<PostStatus, string> = {
  draft: 'Nháp',
  ready: 'Sẵn sàng',
  posted: 'Đã đăng',
  archived: 'Lưu trữ',
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function excerpt(content: string) {
  const text = content.replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function firstLine(content: string) {
  return (
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  );
}

export function PostWorkspace() {
  const router = useRouter();
  const [posts, setPosts] = useState<WorkspacePost[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkspacePostForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgePack, setKnowledgePack] = useState<KnowledgeContextPack | null>(null);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PostStatus>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedId) ?? null,
    [posts, selectedId]
  );

  useEffect(() => {
    void loadPosts();
  }, [query, statusFilter]);

  useEffect(() => {
    if (selectedPost) {
      setForm({
        title: selectedPost.title,
        content: selectedPost.content,
        status: selectedPost.status,
        published_on: selectedPost.published_on ?? '',
        published_url: selectedPost.published_url ?? '',
        notes: selectedPost.notes ?? '',
      });
    } else if (!selectedId) {
      setForm(emptyForm);
    }
  }, [selectedPost, selectedId]);

  useEffect(() => {
    const queryText = knowledgeQueryFromForm();
    if (queryText.length < 12) {
      setKnowledgePack(null);
      setKnowledgeError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void loadKnowledgeContext(queryText);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [form.title, form.content]);

  async function loadPosts() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/posts?${params.toString()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Không thể tải danh sách bài viết.');
      }

      const payload = (await response.json()) as PostsResponse;
      setPosts(payload.posts);

      if (payload.posts.length > 0 && !selectedId) {
        setSelectedId(payload.posts[0].id);
      }
      if (selectedId && !payload.posts.some((post) => post.id === selectedId)) {
        setSelectedId(payload.posts[0]?.id ?? null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể tải danh sách bài viết.');
    } finally {
      setLoading(false);
    }
  }

  function startNewPost() {
    setSelectedId(null);
    setForm(emptyForm);
    setMessage('Đã tạo form mới.');
    setError(null);
  }

  function selectPost(post: WorkspacePost) {
    setSelectedId(post.id);
    setMessage(null);
    setError(null);
  }

  function updateField<K extends keyof WorkspacePostForm>(field: K, value: WorkspacePostForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function savePost() {
    setMessage(null);
    setError(null);

    try {
      await refreshKnowledgeContextBeforeSave();
      setSaving(true);
      const payload = {
        ...form,
        title: form.title.trim() || firstLine(form.content),
        content: form.content.trim(),
        published_on: form.published_on || null,
        published_url: form.published_url || null,
        notes: form.notes || null,
      };

      const response = await fetch(selectedId ? `/api/posts/${selectedId}` : '/api/posts', {
        method: selectedId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payloadError = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payloadError?.error ?? 'Không thể lưu bài viết.');
      }

      const saved = (await response.json()) as { post: WorkspacePost };
      setPosts((current) => {
        const next = current.filter((post) => post.id !== saved.post.id);
        return [saved.post, ...next].sort((a, b) => {
          const left = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          return left;
        });
      });
      setSelectedId(saved.post.id);
      setForm({
        title: saved.post.title,
        content: saved.post.content,
        status: saved.post.status,
        published_on: saved.post.published_on ?? '',
        published_url: saved.post.published_url ?? '',
        notes: saved.post.notes ?? '',
      });
      setMessage('Đã lưu bài viết.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể lưu bài viết.');
    } finally {
      setSaving(false);
    }
  }

  async function deletePost() {
    if (!selectedId) return;
    if (!confirm('Xóa bài viết này? Hành động này không thể hoàn tác.')) return;

    setDeleting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${selectedId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Không thể xóa bài viết.');
      }

      const nextPosts = posts.filter((post) => post.id !== selectedId);
      setPosts(nextPosts);
      setSelectedId(nextPosts[0]?.id ?? null);
      if (nextPosts.length === 0) {
        setForm(emptyForm);
      }
      setMessage('Đã xóa bài viết.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể xóa bài viết.');
    } finally {
      setDeleting(false);
    }
  }

  async function markAsPosted() {
    const today = new Date().toISOString().slice(0, 10);
    await saveWithPatch({
      status: 'posted',
      published_on: form.published_on || today,
    });
  }

  async function saveWithPatch(overrides: Partial<WorkspacePostForm>) {
    if (!selectedId && !form.title.trim() && !form.content.trim()) {
      setError('Hãy nhập title hoặc content trước khi đánh dấu đã đăng.');
      return;
    }

    setMessage(null);
    setError(null);

    try {
      await refreshKnowledgeContextBeforeSave();
      setSaving(true);
      const publishedOn =
        overrides.published_on === ''
          ? null
          : overrides.published_on ?? (form.published_on || null);
      const publishedUrl = overrides.published_url ?? (form.published_url || null);
      const notes = overrides.notes ?? (form.notes || null);

      const payload = {
        ...form,
        ...overrides,
        title: (overrides.title ?? form.title).trim() || firstLine(overrides.content ?? form.content),
        content: (overrides.content ?? form.content).trim(),
        published_on: publishedOn,
        published_url: publishedUrl,
        notes,
        status: overrides.status ?? form.status,
      };

      const response = await fetch(selectedId ? `/api/posts/${selectedId}` : '/api/posts', {
        method: selectedId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payloadError = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payloadError?.error ?? 'Không thể lưu bài viết.');
      }

      const saved = (await response.json()) as { post: WorkspacePost };
      setPosts((current) => {
        const next = current.filter((post) => post.id !== saved.post.id);
        return [saved.post, ...next];
      });
      setSelectedId(saved.post.id);
      setForm({
        title: saved.post.title,
        content: saved.post.content,
        status: saved.post.status,
        published_on: saved.post.published_on ?? '',
        published_url: saved.post.published_url ?? '',
        notes: saved.post.notes ?? '',
      });
      setMessage('Đã cập nhật trạng thái bài viết.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể lưu bài viết.');
    } finally {
      setSaving(false);
    }
  }

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(form.content);
      setMessage('Đã copy nội dung.');
    } catch {
      setError('Không thể copy nội dung trong trình duyệt này.');
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  function knowledgeQueryFromForm() {
    return (form.title.trim() || firstLine(form.content) || form.content.trim().slice(0, 180)).trim();
  }

  async function loadKnowledgeContext(forQuery?: string) {
    const queryText = (forQuery ?? knowledgeQueryFromForm()).trim();
    if (queryText.length < 12) {
      setKnowledgePack(null);
      setKnowledgeError(null);
      return;
    }

    setKnowledgeLoading(true);
    setKnowledgeError(null);

    try {
      const params = new URLSearchParams();
      params.set('q', queryText);
      params.set('limit', '3');
      params.set('sources', 'facebook_posts,website_pages');

      const response = await fetch(`/api/knowledge/context?${params.toString()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Không thể lấy context cho bài viết.');
      }

      const payload = (await response.json()) as { pack?: KnowledgeContextPack };
      setKnowledgePack(payload.pack ?? null);
    } catch (error) {
      setKnowledgeError(error instanceof Error ? error.message : 'Không thể lấy knowledge context.');
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function refreshKnowledgeContextBeforeSave() {
    const queryText = knowledgeQueryFromForm();
    if (queryText.length < 12) {
      return;
    }

    await loadKnowledgeContext(queryText);
  }

  return (
    <div className="page-shell">
      <div className="container">
        <section className="card hero">
          <div>
            <p className="eyebrow">RLG Content Workspace</p>
            <h1 className="title">Xem, sửa, xóa và đánh dấu bài Facebook</h1>
            <p className="subtitle">
              Dùng để quản lý bài viết song ngữ Việt - Anh, lưu vào Supabase và theo dõi bài đã đăng theo ngày.
            </p>
          </div>

          <div className="hero-actions">
            <button className="button" type="button" onClick={loadPosts} disabled={loading}>
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>
            <button className="button" type="button" onClick={startNewPost}>
              Bài mới
            </button>
            <button className="button danger" type="button" onClick={logout}>
              Đăng xuất
            </button>
          </div>
        </section>

        <div className="layout">
          <aside className="card sidebar">
            <h2 className="panel-title">Bài viết</h2>

            <div className="search-row">
              <input
                className="input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo title, content, notes..."
              />

              <select
                className="select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | PostStatus)}
              >
                <option value="all">Tất cả</option>
                <option value="draft">Nháp</option>
                <option value="ready">Sẵn sàng</option>
                <option value="posted">Đã đăng</option>
                <option value="archived">Lưu trữ</option>
              </select>
            </div>

            <div className="list">
              {posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  className={`post-card ${selectedId === post.id ? 'active' : ''}`}
                  onClick={() => selectPost(post)}
                >
                  <h3>{post.title || firstLine(post.content) || 'Không có tiêu đề'}</h3>
                  <p>{excerpt(post.content)}</p>
                  <div className="meta-row">
                    <span className={`badge ${post.status}`}>{statusLabels[post.status]}</span>
                    <span className="badge">{formatDate(post.published_on)}</span>
                  </div>
                </button>
              ))}

              {!loading && posts.length === 0 ? (
                <div className="empty-state">Chưa có bài viết trong workspace này.</div>
              ) : null}
            </div>
          </aside>

          <main className="card workspace">
            <div className="workspace-header">
              <div>
                <h2 className="panel-title" style={{ marginBottom: 4 }}>
                  {selectedId ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới'}
                </h2>
                <p>
                  Dán nội dung agent vào đây, sửa nếu cần, rồi lưu vào bảng workspace riêng. Sau khi đăng fanpage,
                  hãy đánh dấu ngày đăng để theo dõi.
                </p>
                <p style={{ marginTop: 8 }}>
                  Context sẽ được refresh tự động ngay trước khi lưu để giữ gợi ý kiến thức mới nhất.
                </p>
              </div>

              <div className="hero-actions">
                <button className="button" type="button" onClick={copyContent}>
                  Copy content
                </button>
                <button className="button primary" type="button" onClick={savePost} disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu bài'}
                </button>
                <button className="button" type="button" onClick={markAsPosted} disabled={saving}>
                  Đã đăng hôm nay
                </button>
                <button className="button danger" type="button" onClick={deletePost} disabled={!selectedId || deleting}>
                  {deleting ? 'Đang xóa...' : 'Xóa bài'}
                </button>
              </div>
            </div>

            <div className="detail-grid">
              <div className="field-grid">
                <div className="field span-2">
                  <label htmlFor="title">Title</label>
                  <input
                    id="title"
                    className="input"
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    placeholder="Ví dụ: EPR là gì và vì sao doanh nghiệp không thể đứng ngoài?"
                  />
                </div>

                <div className="field span-2">
                  <label htmlFor="content">Content song ngữ Việt - Anh</label>
                  <textarea
                    id="content"
                    className="textarea"
                    value={form.content}
                    onChange={(event) => updateField('content', event.target.value)}
                    placeholder="Dán nội dung song ngữ ở đây..."
                  />
                </div>

                <div className="field">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    className="select"
                    value={form.status}
                    onChange={(event) => updateField('status', event.target.value as PostStatus)}
                  >
                    <option value="draft">Nháp</option>
                    <option value="ready">Sẵn sàng</option>
                    <option value="posted">Đã đăng</option>
                    <option value="archived">Lưu trữ</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="published_on">Ngày đã đăng</label>
                  <input
                    id="published_on"
                    className="input"
                    type="date"
                    value={form.published_on}
                    onChange={(event) => updateField('published_on', event.target.value)}
                  />
                </div>

                <div className="field span-2">
                  <label htmlFor="published_url">Link bài đã đăng trên fanpage</label>
                  <input
                    id="published_url"
                    className="input"
                    value={form.published_url}
                    onChange={(event) => updateField('published_url', event.target.value)}
                    placeholder="https://facebook.com/..."
                  />
                </div>

                <div className="field span-2">
                  <label htmlFor="notes">Notes</label>
                  <textarea
                    id="notes"
                    className="textarea"
                    style={{ minHeight: 140 }}
                    value={form.notes}
                    onChange={(event) => updateField('notes', event.target.value)}
                    placeholder="Ghi chú nội bộ, hashtag, CTA, hoặc lý do chỉnh sửa..."
                  />
                </div>
              </div>

              {selectedPost ? (
                <div className="card" style={{ padding: 16, background: 'rgba(255,255,255,0.02)' }}>
                  <div className="meta-row" style={{ marginTop: 0 }}>
                    <span className={`badge ${selectedPost.status}`}>{statusLabels[selectedPost.status]}</span>
                    <span className="badge">Created: {formatDate(selectedPost.created_at)}</span>
                    <span className="badge">Updated: {formatDate(selectedPost.updated_at)}</span>
                  </div>
                  <p className="footer-note" style={{ marginTop: 12 }}>
                    Bài đang chọn: <strong>{selectedPost.title}</strong>
                  </p>
                </div>
              ) : (
                <div className="empty-state">
                  Chưa chọn bài nào. Tạo bài mới hoặc bấm vào một item bên trái để mở.
                </div>
              )}

              <div className="card" style={{ padding: 16, background: 'rgba(255,255,255,0.02)' }}>
                <div className="workspace-header" style={{ marginBottom: 12 }}>
                  <div>
                    <h3 className="panel-title" style={{ marginBottom: 4 }}>
                      Knowledge Assist
                    </h3>
                    <p>
                      Tự lấy context từ <code>facebook_posts</code> + <code>website_pages</code> theo title/content đang soạn.
                    </p>
                  </div>

                  <button className="button" type="button" onClick={() => void loadKnowledgeContext()}>
                    {knowledgeLoading ? 'Đang lấy context...' : 'Refresh context'}
                  </button>
                </div>

                {knowledgeError ? (
                  <p className="footer-note" style={{ color: 'var(--danger)' }}>
                    {knowledgeError}
                  </p>
                ) : null}

                {knowledgePack ? (
                  <>
                    <div className="meta-row" style={{ marginTop: 0 }}>
                      <span className="badge">Query: {knowledgePack.query}</span>
                      <span className="badge">Chunks: {knowledgePack.chunks.length}</span>
                      <span className="badge">{knowledgePack.source_tables.join(' + ')}</span>
                    </div>
                    <pre
                      className="textarea"
                      style={{
                        marginTop: 12,
                        minHeight: 180,
                        whiteSpace: 'pre-wrap',
                        overflow: 'auto',
                        fontSize: 13,
                      }}
                    >
                      {knowledgePack.context_text}
                    </pre>
                    <button
                      className="button"
                      type="button"
                      onClick={async () => {
                        if (!knowledgePack.context_text) return;
                        await navigator.clipboard.writeText(knowledgePack.context_text);
                        setMessage('Đã copy knowledge assist context.');
                      }}
                      disabled={!knowledgePack.context_text}
                    >
                      Copy context pack
                    </button>
                  </>
                ) : (
                  <div className="empty-state">Gõ title hoặc content để app tự lấy context hỗ trợ.</div>
                )}
              </div>
            </div>

            {message ? <p className="footer-note" style={{ color: 'var(--success)' }}>{message}</p> : null}
            {error ? <p className="footer-note" style={{ color: 'var(--danger)' }}>{error}</p> : null}
            <p className="footer-note">
              Format gợi ý: title → nội dung Việt → dòng phân tách → nội dung Anh → block liên hệ → hashtags.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
