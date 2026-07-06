import { upsertCitrineosAuthorization } from '../citrineos/authorization';
import { BackendApiError, backendApi } from './client';

export async function ensureCitrineosAuthorization(idToken?: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  idToken?: string;
  id?: number;
  status?: string;
  reason?: string;
}> {
  try {
    return await backendApi('/api/citrineos/ensure-authorization', {
      method: 'POST',
      body: JSON.stringify(idToken ? { idToken } : {}),
    });
  } catch (e) {
    // BFF-Route noch nicht deployed → Authorization über bestehenden Hasura-Proxy
    if (e instanceof BackendApiError && e.status === 404 && idToken) {
      return upsertCitrineosAuthorization(idToken);
    }
    throw e;
  }
}
