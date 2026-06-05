import { apiConfig } from '../../config/api';

export class BackendApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'BackendApiError';
  }
}

export async function backendApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${apiConfig.baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new BackendApiError(data.error ?? `API ${res.status}`, res.status);
  }
  return data as T;
}

export async function backendHealth(): Promise<boolean> {
  try {
    const r = await backendApi<{ ok: boolean }>('/api/health');
    return r.ok;
  } catch {
    return false;
  }
}
