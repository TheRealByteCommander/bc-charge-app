/** CitrineOS API v1.8.x – Konfiguration über Umgebungsvariablen (Vite). */

const useDevProxy = import.meta.env.DEV && import.meta.env.VITE_CITRINEOS_USE_PROXY !== 'false';

if (import.meta.env.PROD && import.meta.env.VITE_CITRINEOS_HASURA_ADMIN_SECRET) {
  console.error(
    '[BC Charge] Sicherheit: VITE_CITRINEOS_HASURA_ADMIN_SECRET gehört NICHT ins Frontend. Nur serverseitig nutzen.'
  );
}

export const citrineosConfig = {
  /** REST-API (Swagger: /docs) – Standard docker-compose Port 8080 */
  apiUrl:
    (import.meta.env.VITE_CITRINEOS_API_URL as string | undefined)?.replace(/\/$/, '') ??
    (import.meta.env.PROD ? '/citrineos-api' : (useDevProxy ? '/citrineos-api' : 'http://localhost:8080')),
  /** Hasura GraphQL – Standard Port 8090 */
  hasuraUrl:
    (import.meta.env.VITE_CITRINEOS_HASURA_URL as string | undefined)?.replace(/\/$/, '') ??
    (import.meta.env.PROD ? '/citrineos-hasura/v1/graphql' : (useDevProxy ? '/citrineos-hasura/v1/graphql' : 'http://localhost:8090/v1/graphql')),
  hasuraAdminSecret: (import.meta.env.VITE_CITRINEOS_HASURA_ADMIN_SECRET as string | undefined) ?? '',
  tenantId: Number(import.meta.env.VITE_CITRINEOS_TENANT_ID ?? '1'),
  /** IdToken-Typ für RequestStartTransaction (OCPP 2.0.1) */
  idTokenType: (import.meta.env.VITE_CITRINEOS_ID_TOKEN_TYPE as string | undefined) ?? 'Central',
} as const;

export const isCitrineosConfigured = (): boolean => Boolean(citrineosConfig.apiUrl);
