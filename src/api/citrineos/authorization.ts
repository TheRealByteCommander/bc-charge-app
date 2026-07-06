import { citrineosConfig } from '../../config/citrineos';
import { normalizeIdToken } from '../../utils/ocpp16RemoteStart';
import { hasuraGraphql } from './hasura';

const UPSERT_AUTHORIZATION = `
  mutation BcUpsertAuthorization(
    $tenantId: Int!
    $idToken: String!
    $idTokenType: String!
    $status: String!
    $createdAt: timestamptz!
    $updatedAt: timestamptz!
  ) {
    insert_Authorizations_one(
      object: {
        tenantId: $tenantId
        idToken: $idToken
        idTokenType: $idTokenType
        status: $status
        createdAt: $createdAt
        updatedAt: $updatedAt
      }
      on_conflict: {
        constraint: idToken_type
        update_columns: [status, updatedAt]
      }
    ) {
      id
      idToken
      status
    }
  }
`;

/** Authorization direkt über Hasura-Proxy (Fallback wenn BFF-Route noch nicht deployed). */
export async function upsertCitrineosAuthorization(idToken: string): Promise<{
  ok: boolean;
  id?: number;
  idToken: string;
  status: string;
}> {
  const token = normalizeIdToken(idToken);
  if (!token) {
    throw new Error('ID-Token fehlt');
  }

  const now = new Date().toISOString();
  const data = await hasuraGraphql<{
    insert_Authorizations_one?: { id: number; idToken: string; status: string };
  }>(UPSERT_AUTHORIZATION, {
    tenantId: citrineosConfig.tenantId,
    idToken: token,
    idTokenType: citrineosConfig.idTokenType,
    status: 'Accepted',
    createdAt: now,
    updatedAt: now,
  });

  const row = data.insert_Authorizations_one;
  return {
    ok: true,
    id: row?.id,
    idToken: row?.idToken ?? token,
    status: row?.status ?? 'Accepted',
  };
}
