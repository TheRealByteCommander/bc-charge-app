import { backendApi } from './client';

export async function ensureCitrineosAuthorization(idToken?: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  idToken?: string;
  id?: number;
  status?: string;
  reason?: string;
}> {
  return backendApi('/api/citrineos/ensure-authorization', {
    method: 'POST',
    body: JSON.stringify(idToken ? { idToken } : {}),
  });
}
