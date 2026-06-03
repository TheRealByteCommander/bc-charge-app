import { getCurrentUserId } from './storage';

const apiKey = (import.meta.env.VITE_BC_STRIPE_API_KEY as string | undefined) ?? '';

export function getStripeApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (apiKey) headers['X-BC-API-Key'] = apiKey;
  const userId = getCurrentUserId();
  if (userId) headers['X-BC-User-Id'] = userId;
  return headers;
}
