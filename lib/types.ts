export type PostStatus = 'draft' | 'ready' | 'posted' | 'archived';

export type WorkspacePost = {
  id: string;
  title: string;
  content: string;
  status: PostStatus;
  published_on: string | null;
  published_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspacePostForm = {
  title: string;
  content: string;
  status: PostStatus;
  published_on: string;
  published_url: string;
  notes: string;
};
