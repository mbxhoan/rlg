'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Đăng nhập thất bại.');
      }

      router.replace('/');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <section className="card login-card">
        <p className="eyebrow">RLG Content Workspace</p>
        <h1 className="title" style={{ fontSize: 'clamp(28px, 4vw, 38px)' }}>
          Đăng nhập để quản lý bài viết
        </h1>
        <p className="subtitle">
          Dành cho việc xem, sửa, xoá và đánh dấu các bài Facebook song ngữ trước khi đăng lên fanpage.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="password">Mật khẩu truy cập</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nhập mật khẩu nội bộ"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? <div className="login-error">{error}</div> : null}

          <button className="button primary" type="submit" disabled={loading}>
            {loading ? 'Đang kiểm tra...' : 'Đăng nhập'}
          </button>
        </form>
      </section>
    </div>
  );
}
