'use client';

import { useEffect } from 'react';

/** Registers the offline service worker in production builds. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app works without offline support, so a failed registration is not shown to the user.
    });
  }, []);

  return null;
}
