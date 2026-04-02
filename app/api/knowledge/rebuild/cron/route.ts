import { NextResponse } from 'next/server';
import { rebuildKnowledgeIndex } from '@/lib/knowledge-index';
import { isCurrentRequestAuthenticated } from '@/lib/session';

function isCronRequest(request: Request) {
  return request.headers.get('x-vercel-cron') === '1';
}

async function handleRebuild(request: Request) {
  if (!(isCronRequest(request) || (await isCurrentRequestAuthenticated()))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await rebuildKnowledgeIndex();
    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể rebuild knowledge index.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  return handleRebuild(request);
}

export async function POST(request: Request) {
  return handleRebuild(request);
}
