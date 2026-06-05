import type { UserProfile } from '../../types';
import { backendApi } from './client';

export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  acceptPrivacy: boolean;
  acceptTerms: boolean;
  marketingOptIn?: boolean;
}): Promise<UserProfile> {
  const res = await backendApi<{ user: UserProfile }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.user;
}

export async function loginUser(email: string, password: string): Promise<UserProfile> {
  const res = await backendApi<{ user: UserProfile }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res.user;
}

export async function logoutUser(): Promise<void> {
  await backendApi('/api/auth/logout', { method: 'POST' });
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  try {
    const res = await backendApi<{ user: UserProfile }>('/api/auth/me');
    return res.user;
  } catch {
    return null;
  }
}

export async function deleteAccountRemote(): Promise<void> {
  await backendApi('/api/auth/account', { method: 'DELETE' });
}

export async function downloadExportFromServer(): Promise<void> {
  const url = `${import.meta.env.DEV && import.meta.env.VITE_BC_USE_PROXY !== 'false' ? '' : (import.meta.env.VITE_BC_API_URL ?? 'http://localhost:4242')}/api/auth/export`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Export fehlgeschlagen');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `bc-charge-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(objectUrl);
}
