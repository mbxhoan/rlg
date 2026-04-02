import { NextResponse } from 'next/server';
import { createSessionToken, validateAccessPassword, SESSION_COOKIE_NAME } from '@/lib/session';

type Body = {
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const password = body?.password ?? '';

  if (!validateAccessPassword(password)) {
    return NextResponse.json({ error: 'Sai mật khẩu.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });

  return response;
}
