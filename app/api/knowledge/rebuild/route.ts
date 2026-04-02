import { NextResponse } from 'next/server';
import { rebuildKnowledgeIndex } from '@/lib/knowledge-index';
import { isCurrentRequestAuthenticated } from '@/lib/session';

export async function POST() {
  if (!(await isCurrentRequestAuthenticated())) {
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
