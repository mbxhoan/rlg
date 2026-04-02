import { NextResponse } from 'next/server';
import { importRevLogPages, type RevLogImportInput } from '@/lib/revlog-import';
import { isCurrentRequestAuthenticated } from '@/lib/session';

export async function POST(request: Request) {
  if (!(await isCurrentRequestAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as RevLogImportInput | null;

  try {
    const pages = await importRevLogPages(body ?? {});
    return NextResponse.json({ pages });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể import dữ liệu.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
