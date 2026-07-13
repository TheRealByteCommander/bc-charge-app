import { upsertCitrineosAuthorization } from '../citrineos/authorization';
import { BackendApiError, backendApi } from './client';

const AUTH_CACHE_KEY = 'bc_citrineos_auth_v1';
const AUTH_CACHE_MS = 10 * 60_000;

function readAuthCache(token: string): boolean {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { token?: string; until?: number };
    return parsed.token === token && typeof parsed.until === 'number' && Date.now() < parsed.until;
  } catch {
    return false;
  }
}

function writeAuthCache(token: string): void {
  try {
    sessionStorage.setItem(
      AUTH_CACHE_KEY,
      JSON.stringify({ token, until: Date.now() + AUTH_CACHE_MS })
    );
  } catch {
    /* quota */
  }
}

export async function ensureCitrineosAuthorization(idToken?: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  idToken?: string;
  id?: number;
  status?: string;
  reason?: string;
}> {
  const token = idToken?.trim();
  if (token && readAuthCache(token)) {
    return { ok: true, skipped: true, idToken: token, reason: 'cached' };
  }

  try {
    const result = await backendApi<{
      ok: boolean;
      skipped?: boolean;
      idToken?: string;
      id?: number;
      status?: string;
      reason?: string;
    }>('/api/citrineos/ensure-authorization', {
      method: 'POST',
      body: JSON.stringify(idToken ? { idToken } : {}),
    });
    if (token && result.ok) writeAuthCache(token);
    return result;
  } catch (e) {
    // BFF-Route noch nicht deployed → Authorization über bestehenden Hasura-Proxy
    if (e instanceof BackendApiError && e.status === 404 && idToken) {
      return upsertCitrineosAuthorization(idToken);
    }
    throw e;
  }
}
