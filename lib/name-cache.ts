"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/* The local profile needs a beat to load from IndexedDB before it knows
   your name, which left the greeting skeletal on every single visit. Cache
   the last shown display name (including "Anon" when none is set) in
   localStorage — read pre-paint, so repeat visits paint the greeting on the
   first frame and the live answer replaces it silently (it almost always
   matches). Same idea as lib/suggestion-cache.ts. */

const CACHE_KEY = "greeting-name";

/**
 * The name the greeting should show right now: the live profile name once
 * it's in, the cached one until then, or null on a truly first visit.
 * `warm` tells the greeting whether the cache got here before the profile
 * did — warm headers render statically instead of animating in, and it
 * stays true once the live name replaces the cached one.
 */
export function useCachedName(liveName: string | null): {
  name: string | null;
  warm: boolean;
} {
  const [cached, setCached] = useState<string | null>(null);
  /* Latched with the cache read, because this is the only moment that can
     answer it: once the profile loads, "did the cache get here first?" is no
     longer visible in the values. It's state rather than a ref written
     during render — the greeting reads it on the very frame it appears,
     and a render React discards must not be what decides whether that
     frame animates. */
  const [warm, setWarm] = useState(false);

  /* Layout effect: client-only (prerender and hydration never touch storage)
     but still ahead of the first paint. */
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (!stored) return;
      setCached(stored);
      /* The profile beat the cache read — never a cache-warm paint. */
      if (!liveName) setWarm(true);
    } catch {
      // private mode etc. — this visit just loads the slow way
    }
    // Mount only: a later liveName must not retroactively change the answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!liveName) return;
    try {
      localStorage.setItem(CACHE_KEY, liveName);
    } catch {
      // best effort — next visit animates in again
    }
  }, [liveName]);

  return { name: liveName ?? cached, warm };
}
