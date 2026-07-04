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
  const data = await hasuraRequest(UPSERT_AUTHORIZATION, {
    tenantId: tenantId(),
    idToken,
    idTokenType: idTokenType(),
    status: 'Accepted',
    createdAt: now,
    updatedAt: now,
  });

  return {
    ok: true,
    id: data.insert_Authorizations_one?.id,
    idToken: data.insert_Authorizations_one?.idToken ?? idToken,
    status: data.insert_Authorizations_one?.status ?? 'Accepted',
  };
}
