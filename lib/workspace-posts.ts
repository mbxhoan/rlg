import { FACEBOOK_POSTS_WORKSPACE_TABLE, supabaseAdmin } from '@/lib/supabase-admin';
import type { PostStatus, WorkspacePost, WorkspacePostForm } from '@/lib/types';

const allowedStatuses: PostStatus[] = ['draft', 'ready', 'posted', 'archived'];

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeForDuplicateCheck(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[“”"'"'`.,!?;:()[\]{}<>*#@~—–-]/g, '')
    .trim();
}

function normalizeNullableText(value: unknown) {
  const text = normalizeText(value);
  return text.length > 0 ? text : null;
}

function normalizeStatus(value: unknown): PostStatus {
  if (typeof value === 'string' && allowedStatuses.includes(value as PostStatus)) {
    return value as PostStatus;
  }
  return 'draft';
}

function toForm(record: WorkspacePost): WorkspacePostForm {
  return {
    title: record.title,
    content: record.content,
    status: record.status,
    published_on: record.published_on ?? '',
    published_url: record.published_url ?? '',
    notes: record.notes ?? '',
  };
}

export function blankWorkspacePostForm(): WorkspacePostForm {
  return {
    title: '',
    content: '',
    status: 'draft',
    published_on: '',
    published_url: '',
    notes: '',
  };
}

export function mapRecordToForm(record: WorkspacePost) {
  return toForm(record);
}

export async function listWorkspacePosts(params: {
  q?: string;
  status?: string;
  limit?: number;
}) {
  const limit = Number.isFinite(params.limit) ? Math.min(params.limit ?? 200, 500) : 200;
  let query = supabaseAdmin
    .from(FACEBOOK_POSTS_WORKSPACE_TABLE)
    .select('id,title,content,status,published_on,published_url,notes,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  if (params.q && params.q.trim().length > 0) {
    const q = params.q.trim().replaceAll(',', ' ');
    query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,notes.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as WorkspacePost[];
}

export async function getWorkspacePost(id: string) {
  const { data, error } = await supabaseAdmin
    .from(FACEBOOK_POSTS_WORKSPACE_TABLE)
    .select('id,title,content,status,published_on,published_url,notes,created_at,updated_at')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as WorkspacePost;
}

export async function createWorkspacePost(input: Partial<WorkspacePostForm>) {
  const title = normalizeText(input.title) || firstLine(input.content);
  const content = normalizeText(input.content);

  if (!title) {
    throw new Error('Title is required.');
  }

  if (!content) {
    throw new Error('Content is required.');
  }

  const duplicate = await findDuplicateMatch(content);
  if (duplicate) {
    throw new Error(
      `Nội dung đã tồn tại trong ${duplicate.source} (${duplicate.id}) và không thể lưu trùng.`
    );
  }

  const payload = {
    title,
    content,
    status: normalizeStatus(input.status),
    published_on: normalizeNullableText(input.published_on),
    published_url: normalizeNullableText(input.published_url),
    notes: normalizeNullableText(input.notes),
  };

  const { data, error } = await supabaseAdmin
    .from(FACEBOOK_POSTS_WORKSPACE_TABLE)
    .insert(payload)
    .select('id,title,content,status,published_on,published_url,notes,created_at,updated_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as WorkspacePost;
}

export async function updateWorkspacePost(id: string, input: Partial<WorkspacePostForm>) {
  const title = normalizeText(input.title) || firstLine(input.content);
  const content = normalizeText(input.content);

  if (!title) {
    throw new Error('Title is required.');
  }

  if (!content) {
    throw new Error('Content is required.');
  }

  const duplicate = await findDuplicateMatch(content, id);
  if (duplicate) {
    throw new Error(
      `Nội dung đã tồn tại trong ${duplicate.source} (${duplicate.id}) và không thể lưu trùng.`
    );
  }

  const payload = {
    title,
    content,
    status: normalizeStatus(input.status),
    published_on: normalizeNullableText(input.published_on),
    published_url: normalizeNullableText(input.published_url),
    notes: normalizeNullableText(input.notes),
  };

  const { data, error } = await supabaseAdmin
    .from(FACEBOOK_POSTS_WORKSPACE_TABLE)
    .update(payload)
    .eq('id', id)
    .select('id,title,content,status,published_on,published_url,notes,created_at,updated_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as WorkspacePost;
}

export async function deleteWorkspacePost(id: string) {
  const { error } = await supabaseAdmin.from(FACEBOOK_POSTS_WORKSPACE_TABLE).delete().eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}

type DuplicateMatch = {
  id: string;
  source: 'facebook_posts' | 'facebook_posts_workspace';
  title: string;
};

async function findDuplicateMatch(content: string, excludeWorkspaceId?: string) {
  const fingerprint = normalizeForDuplicateCheck(content);
  if (!fingerprint) return null;

  const [historicalResult, workspaceResult] = await Promise.all([
    supabaseAdmin.from('facebook_posts').select('post_id,content').limit(1000),
    supabaseAdmin
      .from(FACEBOOK_POSTS_WORKSPACE_TABLE)
      .select('id,title,content')
      .limit(1000),
  ]);

  if (historicalResult.error) {
    throw new Error(historicalResult.error.message);
  }

  if (workspaceResult.error) {
    throw new Error(workspaceResult.error.message);
  }

  for (const row of historicalResult.data ?? []) {
    const historicalRow = row as { post_id: string; content: string };
    if (normalizeForDuplicateCheck(historicalRow.content ?? '') === fingerprint) {
      return {
        id: historicalRow.post_id,
        source: 'facebook_posts' as const,
        title: firstLine(historicalRow.content) || historicalRow.post_id,
      };
    }
  }

  for (const row of workspaceResult.data ?? []) {
    const workspaceRow = row as { id: string; title: string | null; content: string };
    if (excludeWorkspaceId && workspaceRow.id === excludeWorkspaceId) {
      continue;
    }

    if (normalizeForDuplicateCheck(workspaceRow.content ?? '') === fingerprint) {
      return {
        id: workspaceRow.id,
        source: 'facebook_posts_workspace' as const,
        title: workspaceRow.title || workspaceRow.id,
      };
    }
  }

  return null;
}

function firstLine(content?: string) {
  if (!content) return '';
  const line = content
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find(Boolean);
  return line ?? '';
}
