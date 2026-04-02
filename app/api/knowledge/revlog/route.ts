import { NextResponse } from 'next/server';
import { listRevLogPages } from '@/lib/revlog-import';
import { isCurrentRequestAuthenticated } from '@/lib/session';

export async function GET() {
  if (!(await isCurrentRequestAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pages = await listRevLogPages();
    return NextResponse.json({ pages });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể đọc dữ liệu.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
