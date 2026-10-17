"use client";

import { useEffect } from "react";

import { publicPath } from "@/lib/base-path";

/* Registers public/sw.js — the offline copy of the app.
 *
 * Production only, and it actively tears the worker down everywhere else.
 * A worker registered against localhost outlives the build that installed
 * it: it keeps answering after the next `next dev` starts, and the first
 * thing anyone blames for a stale page is the code they just wrote. So dev
 * doesn't just skip registering — it unregisters whatever is already there,
 * including one left behind by a production build served from this port. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((one) => one.unregister())),
        )
        .catch(() => {
          // Nothing registered, or the browser said no. Either is fine here.
        });
      return;
    }

    /* After load, not during it: registration competes with the chunks for
       the same connection, and nothing on screen is waiting on it. */
    let cancelled = false;
    const register = () => {
      if (cancelled) return;
      navigator.serviceWorker
        .register(publicPath("/sw.js"), { scope: publicPath("/") })
        .catch((error) => {
          /* Nothing on screen breaks without it — the worker only ever adds
             an offline copy. Worth a line in the console so a missing one is
             explainable rather than mysterious. */
          console.warn("Waylay: offline support is unavailable —", error);
        });
    };

    if (document.readyState === "complete") {
      register();
      return () => {
        cancelled = true;
      };
    }
    window.addEventListener("load", register, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
