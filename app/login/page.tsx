import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { getSessionTokenFromCookies, isSessionTokenValid } from '@/lib/session';

export default async function LoginPage() {
  const token = await getSessionTokenFromCookies();

  if (isSessionTokenValid(token)) {
    redirect('/');
  }

  return <LoginForm />;
}
