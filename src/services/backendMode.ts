import { apiConfig } from '../config/api';

export function isBackendMode(): boolean {
  return apiConfig.useBackend;
}
