import { NextResponse } from 'next/server';
import { createWorkspacePost, listWorkspacePosts } from '@/lib/workspace-posts';
import { isCurrentRequestAuthenticated } from '@/lib/session';

export async function GET(request: Request) {
  if (!(await isCurrentRequestAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;

  try {
    const posts = await listWorkspacePosts({ q, status });
    return NextResponse.json({ posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể đọc bài viết.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isCurrentRequestAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  try {
    const post = await createWorkspacePost(body ?? {});
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tạo bài viết.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
