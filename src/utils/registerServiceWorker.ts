type UpdateCallback = (registration: ServiceWorkerRegistration) => void;

let updateCallback: UpdateCallback | null = null;

export function onServiceWorkerUpdate(callback: UpdateCallback): void {
  updateCallback = callback;
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (updateCallback) {
              updateCallback(registration);
            }
          }
        });
      });

      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);
    } catch {
      console.warn('Service Worker registration failed');
    }
  });
}

export function skipWaitingAndReload(): void {
  navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
  window.location.reload();
}
