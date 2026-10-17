"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { ComposerModel, ThinkingLevel } from "@/lib/models";

/* The composer's thinking gate, remembered like the model pick: kept in
   localStorage and shared through a tiny external store so the picker, the
   command palette and the send all see a toggle the same frame.

   Storage holds the user's raw choice; what a send actually carries is
   that choice run through effectiveGates — the same clamp the picker chip
   displays, so what you see is what the model gets. */

const THINKING_KEY = "composer-thinking";
const CHANGE_EVENT = "waylay:composer-gates";

export type ComposerGates = { thinking: ThinkingLevel };

const DEFAULT_GATES: ComposerGates = { thinking: "high" };

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
    const thinking = localStorage.getItem(THINKING_KEY);
    return {
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

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THINKING_KEY) return;
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

export function useThinkingPref() {
  const gates = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_GATES);
  const setThinking = useCallback((next: ThinkingLevel) => {
    cached = { thinking: next };
    try {
      localStorage.setItem(THINKING_KEY, next);
    } catch {
      // private mode etc. — the cached value still applies for this visit
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [gates.thinking, setThinking] as const;
}

/** The thinking level the current model can actually run — models that
 * can't think only have "none". The picker's wheel clamp, shared so the
 * chip and the send can never disagree. */
export function clampThinking(
  model: ComposerModel | undefined,
  thinking: ThinkingLevel,
): ThinkingLevel {
  const levels = model?.thinkingLevels ?? ["none"];
  return levels.includes(thinking) ? thinking : levels[0];
}

/** What a send actually carries — the picker-visible truth. Auto runs the
 * gate itself, so the stored choice passes through; everything else sends
 * the level clamped to the model's wheel. */
export function effectiveGates(
  model: ComposerModel | undefined,
  gates: ComposerGates,
): ComposerGates {
  if (model?.autoGates) return gates;
  return { thinking: clampThinking(model, gates.thinking) };
}
