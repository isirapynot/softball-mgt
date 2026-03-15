import { cookies } from 'next/headers';

export type AuthRole = 'admin' | 'player';

export async function getAuthRole(): Promise<AuthRole | null> {
  const cookieStore = await cookies();
  const role = cookieStore.get('auth_role')?.value;
  if (role === 'admin' || role === 'player') return role;
  return null;
}

export async function requireAdmin(): Promise<boolean> {
  const role = await getAuthRole();
  return role === 'admin';
}

export async function requirePlayerOrAdmin(): Promise<boolean> {
  const role = await getAuthRole();
  return role === 'admin' || role === 'player';
}
