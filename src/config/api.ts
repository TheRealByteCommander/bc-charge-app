const useDevProxy = import.meta.env.DEV && import.meta.env.VITE_BC_USE_PROXY !== 'false';

export const apiConfig = {
  baseUrl:
    (import.meta.env.VITE_BC_API_URL as string | undefined)?.replace(/\/$/, '') ??
    (useDevProxy ? '' : 'http://localhost:4242'),
  useBackend:
    import.meta.env.VITE_BC_USE_BACKEND === 'true' ||
    (import.meta.env.PROD && import.meta.env.VITE_BC_USE_BACKEND !== 'false'),
} as const;
