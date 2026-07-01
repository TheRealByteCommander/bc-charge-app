const useDevProxy = import.meta.env.DEV && import.meta.env.VITE_STRIPE_USE_PROXY !== 'false';

export const stripeConfig = {
  publishableKey: (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ?? '',
  apiBase:
    (import.meta.env.VITE_STRIPE_API_URL as string | undefined)?.replace(/\/$/, '') ??
    (import.meta.env.PROD ? '' : (useDevProxy ? '' : 'http://localhost:4242')),
} as const;

export const isStripeConfigured = (): boolean => Boolean(stripeConfig.publishableKey);
