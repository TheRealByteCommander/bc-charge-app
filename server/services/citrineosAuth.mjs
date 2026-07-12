/** CitrineOS ID-Token / Authorization (Hasura) – Pflicht für RemoteStart (go-e, H2, …). */

function hasuraUrl() {
  return (process.env.CITRINEOS_HASURA_URL ?? 'http://localhost:8090/v1/graphql').replace(/\/$/, '');
}

function tenantId() {
  return Number(process.env.CITRINEOS_TENANT_ID ?? '1');
}

function idTokenType() {
  return process.env.CITRINEOS_ID_TOKEN_TYPE ?? 'Central';
}

export function isCitrineosAuthConfigured() {
  return Boolean(process.env.CITRINEOS_HASURA_URL);
}

/** OCPP 1.6: idTag max. 20 Zeichen. */
export function normalizeIdToken(idToken) {
  const trimmed = String(idToken ?? '').trim();
  if (!trimmed) return '';
  return trimmed.length <= 20 ? trimmed : trimmed.slice(0, 20);
}

async function hasuraRequest(query, variables) {
  if (!process.env.CITRINEOS_HASURA_URL) {
    throw new Error('Hasura nicht konfiguriert');
  }
  const headers = { 'Content-Type': 'application/json' };
  const secret = process.env.CITRINEOS_HASURA_ADMIN_SECRET;
  if (secret) headers['x-hasura-admin-secret'] = secret;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let res;
  try {
    res = await fetch(hasuraUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message ?? `Hasura ${res.status}`);
  }
  return json.data;
}

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

function isUniqueViolation(message) {
  return /unique|duplicate|Uniqueness violation/i.test(message);
}

async function upsertAuthorizationViaHasura({ tenantId: tid, idToken, idTokenType: tokenType, status, createdAt, updatedAt }) {
  const vars = { tenantId: tid, idToken, idTokenType: tokenType };

  const found = await hasuraRequest(FIND_AUTHORIZATION, vars);
  const existing = found.Authorizations?.[0];
  if (existing) {
    if (existing.status === status) {
      return { idToken: existing.idToken, status: existing.status };
    }
    const updated = await hasuraRequest(UPDATE_AUTHORIZATION, { ...vars, status, updatedAt });
    const row = updated.update_Authorizations?.returning?.[0];
    return { idToken: row?.idToken ?? idToken, status: row?.status ?? status };
  }

  try {
    const inserted = await hasuraRequest(INSERT_AUTHORIZATION, {
      ...vars,
      status,
      createdAt,
      updatedAt,
    });
    const row = inserted.insert_Authorizations_one;
    return { idToken: row?.idToken ?? idToken, status: row?.status ?? status };
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (!isUniqueViolation(message)) throw e;

    const again = await hasuraRequest(FIND_AUTHORIZATION, vars);
    const row = again.Authorizations?.[0];
    if (!row) throw e;
    if (row.status === status) {
      return { idToken: row.idToken, status: row.status };
    }
    const updated = await hasuraRequest(UPDATE_AUTHORIZATION, { ...vars, status, updatedAt });
    const ret = updated.update_Authorizations?.returning?.[0];
    return { idToken: ret?.idToken ?? idToken, status: ret?.status ?? status };
  }
}

/**
 * Legt membershipId als akzeptiertes ID-Token in CitrineOS an (idempotent).
 * Ohne Eintrag lehnt go-e / OCPP 1.6 RemoteStart ab → Fahrzeug „nicht bereit“.
 */
export async function ensureCitrineosAuthorization(rawIdToken) {
  const idToken = normalizeIdToken(rawIdToken);
  if (!idToken) {
    throw new Error('ID-Token fehlt');
  }
  if (!isCitrineosAuthConfigured()) {
    return { ok: false, skipped: true, reason: 'Hasura nicht konfiguriert' };
  }

  const now = new Date().toISOString();
  const row = await upsertAuthorizationViaHasura({
    tenantId: tenantId(),
    idToken,
    idTokenType: idTokenType(),
    status: 'Accepted',
    createdAt: now,
    updatedAt: now,
  });

  return {
    ok: true,
    idToken: row.idToken ?? idToken,
    status: row.status ?? 'Accepted',
  };
}
