"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useLocalSession, useMutation, useQuery } from "@/lib/local/react";

import { api } from "@/lib/local/api";
import { CHAT_MODELS } from "@/lib/models";
import { showToast } from "@/lib/toasts";

/* Which models the user pinned into the compact picker. The preset tiers
   start favorited; admin catalog models start unpinned (they live in the
   search list) and earn a spot via the star.

   Synced, cache-then-live: localStorage paints instantly (and is the whole
   story until the database loads), the IndexedDB row is the truth after —
   adopted whenever it changes, written on every toggle. The value rides a
   tiny external store so the composer, the picker, and settings all see a
   toggle the same frame. */

const CACHE_KEY = "model-favorites";
const CHANGE_EVENT = "waylay:model-favorites";

const DEFAULT_KEYS = CHAT_MODELS.map((model) => model.key as string);
const DEFAULT_SET: ReadonlySet<string> = new Set(DEFAULT_KEYS);

/* Keys are pruned against the lineup, so a model that has since been
   removed just drops out. */
function sanitize(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(
    (key): key is string => typeof key === "string" && DEFAULT_KEYS.includes(key),
  );
}

let cached: ReadonlySet<string> | null = null;

function read(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return DEFAULT_SET;
    const parsed = sanitize(JSON.parse(raw));
    return parsed ? new Set(parsed) : DEFAULT_SET;
  } catch {
    return DEFAULT_SET;
  }
}

function snapshot(): ReadonlySet<string> {
  if (cached === null) cached = read();
  return cached;
}

function setLocal(next: ReadonlySet<string>) {
  cached = next;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify([...next]));
  } catch {
    // private mode etc. — the cached value still applies for this visit
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CACHE_KEY) return;
    cached = null;
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function sameSet(a: ReadonlySet<string>, b: string[]): boolean {
  return a.size === b.length && b.every((key) => a.has(key));
}

/* First load with local picks but no stored row writes local in exactly
   once (the migration) — module-level so several mounted hooks don't race. */
let migrationPushed = false;

export function useModelFavorites() {
  const favorites = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_SET);

  const { isAuthenticated } = useLocalSession();
  const server = useQuery(
    api.modelFavorites.get,
    isAuthenticated ? {} : "skip",
  );
  const save = useMutation(api.modelFavorites.save);
  // Saves in flight — the query echoing an older list mid-toggle must not
  // snap the star back; the post-save update converges everyone anyway.
  const inFlight = useRef(0);

  useEffect(() => {
    if (server === undefined || inFlight.current > 0) return;
    if (server === null) {
      // Database loaded, nothing saved yet: local picks that differ from
      // the defaults are worth keeping — write them in once.
      if (!migrationPushed && !sameSet(snapshot(), DEFAULT_KEYS)) {
        migrationPushed = true;
        save({ keys: [...snapshot()] }).catch(() => {
          // Next toggle retries; local keeps working meanwhile.
          migrationPushed = false;
        });
      }
      return;
    }
    const clean = sanitize(server) ?? [];
    if (!sameSet(snapshot(), clean)) setLocal(new Set(clean));
  }, [server, save]);

  const toggleFavorite = (key: string) => {
    const next = new Set(snapshot());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setLocal(next);
    if (!isAuthenticated) return;
    inFlight.current++;
    save({ keys: [...next] })
      .catch(() =>
        showToast(
          "Couldn't sync that favorite — it'll stay on this device for now.",
        ),
      )
      .finally(() => {
        inFlight.current--;
      });
  };

  return { favorites, toggleFavorite };
}
