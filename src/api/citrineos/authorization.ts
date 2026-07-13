import { citrineosConfig } from '../../config/citrineos';
import { normalizeIdToken } from '../../utils/ocpp16RemoteStart';
import { hasuraGraphql } from './hasura';

const FIND_AUTHORIZATION = `
  query BcFindAuthorization($tenantId: Int!, $idToken: citext!, $idTokenType: String!) {
    Authorizations(
      where: {
        tenantId: { _eq: $tenantId }
        idToken: { _eq: $idToken }
        idTokenType: { _eq: $idTokenType }
      }
      limit: 1
    ) {
      idToken
      status
    }
  }
`;

const INSERT_AUTHORIZATION = `
  mutation BcInsertAuthorization(
    $tenantId: Int!
    $idToken: citext!
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
    ) {
      idToken
      status
    }
  }
`;

const UPDATE_AUTHORIZATION = `
  mutation BcUpdateAuthorization(
    $tenantId: Int!
    $idToken: citext!
    $idTokenType: String!
    $status: String!
    $updatedAt: timestamptz!
  ) {
    update_Authorizations(
      where: {
        tenantId: { _eq: $tenantId }
        idToken: { _eq: $idToken }
        idTokenType: { _eq: $idTokenType }
      }
      _set: { status: $status, updatedAt: $updatedAt }
    ) {
      returning {
        idToken
        status
      }
    }
  }
`;

type AuthorizationRow = { idToken: string; status: string };

function isUniqueViolation(message: string): boolean {
  return /unique|duplicate|Uniqueness violation/i.test(message);
}

async function upsertAuthorizationViaHasura(opts: {
  tenantId: number;
  idToken: string;
  idTokenType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}): Promise<AuthorizationRow> {
  const vars = {
    tenantId: opts.tenantId,
    idToken: opts.idToken,
    idTokenType: opts.idTokenType,
  };

  const found = await hasuraGraphql<{ Authorizations: AuthorizationRow[] }>(FIND_AUTHORIZATION, vars);
  const existing = found.Authorizations?.[0];
  if (existing) {
    if (existing.status === opts.status) return existing;
    const updated = await hasuraGraphql<{ update_Authorizations: { returning: AuthorizationRow[] } }>(
      UPDATE_AUTHORIZATION,
      { ...vars, status: opts.status, updatedAt: opts.updatedAt }
    );
    return updated.update_Authorizations.returning[0] ?? existing;
  }

  try {
    const inserted = await hasuraGraphql<{ insert_Authorizations_one: AuthorizationRow }>(INSERT_AUTHORIZATION, {
      ...vars,
      status: opts.status,
      createdAt: opts.createdAt,
      updatedAt: opts.updatedAt,
    });
    return inserted.insert_Authorizations_one;
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (!isUniqueViolation(message)) throw e;

    const again = await hasuraGraphql<{ Authorizations: AuthorizationRow[] }>(FIND_AUTHORIZATION, vars);
    const row = again.Authorizations?.[0];
    if (!row) throw e;
    if (row.status === opts.status) return row;

    const updated = await hasuraGraphql<{ update_Authorizations: { returning: AuthorizationRow[] } }>(
      UPDATE_AUTHORIZATION,
      { ...vars, status: opts.status, updatedAt: opts.updatedAt }
    );
    return updated.update_Authorizations.returning[0] ?? row;
  }
}

/** Authorization direkt über Hasura-Proxy (Fallback wenn BFF-Route noch nicht deployed). */
export async function upsertCitrineosAuthorization(idToken: string): Promise<{
  ok: boolean;
  idToken: string;
  status: string;
}> {
  const token = normalizeIdToken(idToken);
  if (!token) {
    throw new Error('ID-Token fehlt');
  }

  const now = new Date().toISOString();
  const row = await upsertAuthorizationViaHasura({
    tenantId: citrineosConfig.tenantId,
    idToken: token,
    idTokenType: citrineosConfig.idTokenType,
    status: 'Accepted',
    createdAt: now,
    updatedAt: now,
  });

  return {
    ok: true,
    idToken: row.idToken ?? token,
    status: row.status ?? 'Accepted',
  };
}
