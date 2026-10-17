"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useLocalSession, useMutation, useQuery } from "@/lib/local/react";

import { api } from "@/lib/local/api";
import type { ComposerModel, ThinkingLevel } from "@/lib/models";
import { showToast } from "@/lib/toasts";

/* The composer's search/thinking gates, remembered like the model pick —
   but synced (modelFavorites pattern): localStorage paints instantly and
   is the whole story until the database loads, the IndexedDB row is the
   truth from then on — adopted whenever it changes, written on every
   toggle. That also makes the choices survive a cleared localStorage: a
   wiped mirror just re-adopts the stored row on the next load.

   Storage holds the user's raw choice; what a send actually carries is
   that choice run through effectiveGates — the same clamp the picker chip
   displays, so what you see is what the model gets. The value rides a
   tiny external store so every mounted hook sees a toggle the same
   frame. */

const SEARCH_KEY = "composer-search";
const THINKING_KEY = "composer-thinking";
const CHANGE_EVENT = "waylay:composer-gates";

export type ComposerGates = { search: boolean; thinking: ThinkingLevel };

const DEFAULT_GATES: ComposerGates = { search: false, thinking: "low" };

const THINKING_LEVELS: readonly ThinkingLevel[] = [
  "none",
  "low",
  "medium",
  "high",
];

function isThinkingLevel(value: string): value is ThinkingLevel {
  return (THINKING_LEVELS as readonly string[]).includes(value);
}

let cached: ComposerGates | null = null;

function read(): ComposerGates {
  try {
    const search = localStorage.getItem(SEARCH_KEY);
    const thinking = localStorage.getItem(THINKING_KEY);
    return {
      search: search === null ? DEFAULT_GATES.search : search === "on",
      thinking:
        thinking !== null && isThinkingLevel(thinking)
          ? thinking
          : DEFAULT_GATES.thinking,
    };
  } catch {
    return DEFAULT_GATES;
  }
}

function snapshot(): ComposerGates {
  if (cached === null) cached = read();
  return cached;
}

function setLocal(next: ComposerGates) {
  cached = next;
  try {
    localStorage.setItem(SEARCH_KEY, next.search ? "on" : "off");
    localStorage.setItem(THINKING_KEY, next.thinking);
  } catch {
    // private mode etc. — the cached value still applies for this visit
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SEARCH_KEY && event.key !== THINKING_KEY) return;
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

/* First load with local choices but no stored row writes local in
   exactly once (the migration) — module-level so several mounted hooks
   don't race. */
let migrationPushed = false;

/* Saves in flight — the query echoing an older pair mid-toggle must not
   snap a switch back; the local store already holds the truth and the
   database converges everyone the moment the mutation lands. Module-level
   because the store is: search and thinking each mount their own hook (in
   the composer *and* the command palette), and a per-instance count would
   let every instance but the one that saved adopt the stale row right
   back over the toggle — which is the flicker you feel dragging the
   thinking slider. */
let inFlight = 0;

function useSyncedGates() {
  const { isAuthenticated } = useLocalSession();
  const server = useQuery(api.composerGates.get, isAuthenticated ? {} : "skip");
  /* Deliberately not optimistic: the local store is already the instant
     paint, and patching the query cache too would make a *failed* save
     roll the cache back to the pre-toggle row — which then arrives as a
     stored change and overwrites the choice we just promised would stay on
     this device (and, mid-migration, retriggers the push that just
     failed). Leaving the cache alone means a failure is simply silent. */
  const save = useMutation(api.composerGates.save);

  useEffect(() => {
    if (server === undefined || inFlight > 0) return;
    const local = snapshot();
    if (server === null) {
      // Database loaded, nothing saved yet: local choices that differ from
      // the defaults are worth keeping — write them in once.
      const differs =
        local.search !== DEFAULT_GATES.search ||
        local.thinking !== DEFAULT_GATES.thinking;
      if (!migrationPushed && differs) {
        migrationPushed = true;
        save(local).catch(() => {
          // Next toggle retries; local keeps working meanwhile.
          migrationPushed = false;
        });
      }
      return;
    }
    const clean: ComposerGates = {
      search: server.search,
      thinking: isThinkingLevel(server.thinking)
        ? server.thinking
        : DEFAULT_GATES.thinking,
    };
    if (clean.search !== local.search || clean.thinking !== local.thinking) {
      setLocal(clean);
    }
  }, [server, save]);

  /* Local first, always: the toggle paints this frame and the database
     write happens behind it. A failed save keeps the local choice and says
     so. */
  const set = useCallback(
    (next: ComposerGates) => {
      setLocal(next);
      if (!isAuthenticated) return;
      inFlight++;
      save(next)
        .catch(() =>
          showToast(
            "Couldn't sync that toggle — it'll stay on this device for now.",
          ),
        )
        .finally(() => {
          inFlight--;
        });
    },
    [isAuthenticated, save],
  );

  return set;
}

export function useSearchPref() {
  const set = useSyncedGates();
  const gates = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_GATES);
  /* Read the store, not this render's `gates` — a toggle fired twice in a
     frame must build on the newer half, not overwrite it. */
  const setSearch = useCallback(
    (next: boolean) => set({ ...snapshot(), search: next }),
    [set],
  );
  return [gates.search, setSearch] as const;
}

export function useThinkingPref() {
  const set = useSyncedGates();
  const gates = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_GATES);
  const setThinking = useCallback(
    (next: ThinkingLevel) => set({ ...snapshot(), thinking: next }),
    [set],
  );
  return [gates.thinking, setThinking] as const;
}

/** The thinking level the current model can actually run — Heavy has no
 * "none", Image has nothing else. The picker's wheel clamp, shared so the
 * chip and the send can never disagree. */
export function clampThinking(
  model: ComposerModel | undefined,
  thinking: ThinkingLevel,
): ThinkingLevel {
  const levels = model?.thinkingLevels ?? ["none"];
  return levels.includes(thinking) ? thinking : levels[0];
}

/** What a send actually carries — the picker-visible truth. Image models
 * have no gates at all (the chip reads "None"); Auto runs the gates itself,
 * so the stored choices pass through for the backend to honor. Everything
 * else sends the level clamped to the model's wheel. */
export function effectiveGates(
  model: ComposerModel | undefined,
  gates: ComposerGates,
): ComposerGates {
  if (model?.imageOutput) return { search: false, thinking: "none" };
  if (model?.autoGates) return gates;
  return { search: gates.search, thinking: clampThinking(model, gates.thinking) };
}
