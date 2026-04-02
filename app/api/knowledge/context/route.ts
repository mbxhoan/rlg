import { NextResponse } from 'next/server';
import { buildKnowledgeContext } from '@/lib/knowledge-index';
import { isCurrentRequestAuthenticated } from '@/lib/session';

export async function GET(request: Request) {
  if (!(await isCurrentRequestAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';
  const limit = Number(url.searchParams.get('limit') ?? '3');
  const sources = url.searchParams
    .get('sources')
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) as ('facebook_posts' | 'website_pages')[] | undefined;

  if (!query) {
    return NextResponse.json({ error: 'Query is required.' }, { status: 400 });
  }

  try {
    const pack = await buildKnowledgeContext({
      query,
      limit: Number.isFinite(limit) ? limit : 3,
      sourceTables: sources?.length ? sources : undefined,
    });

    return NextResponse.json({ pack });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể build context.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
