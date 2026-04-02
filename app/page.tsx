import { redirect } from 'next/navigation';
import { KnowledgePanel } from '@/components/knowledge-panel';
import { PostWorkspace } from '@/components/post-workspace';
import { getSessionTokenFromCookies, isSessionTokenValid } from '@/lib/session';

export default async function HomePage() {
  const token = await getSessionTokenFromCookies();

  if (!isSessionTokenValid(token)) {
    redirect('/login');
  }

  return (
    <>
      <PostWorkspace />
      <KnowledgePanel />
    </>
  );
}
