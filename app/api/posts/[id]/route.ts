import { NextResponse } from 'next/server';
import { deleteWorkspacePost, getWorkspacePost, updateWorkspacePost } from '@/lib/workspace-posts';
import { isCurrentRequestAuthenticated } from '@/lib/session';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isCurrentRequestAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const post = await getWorkspacePost(id);
    return NextResponse.json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể đọc bài viết.';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isCurrentRequestAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  try {
    const { id } = await params;
    const post = await updateWorkspacePost(id, body ?? {});
    return NextResponse.json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể cập nhật bài viết.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isCurrentRequestAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await deleteWorkspacePost(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể xóa bài viết.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
