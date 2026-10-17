import { mutation, query } from "../functions";
import { getSetting, setSetting } from "../settings";

/** Hard cap so a runaway paste can't bloat every system prompt. */
export const MAX_PREFERENCES_LENGTH = 2000;

type Preferences = { text: string; updatedAt: number };

export const getPreferences = query((ctx) => getSetting<Preferences>(ctx.db, "preferences") ?? null);

/** An empty string clears them. */
export const setPreferences = mutation((ctx, { text }: { text: string }) => {
  const trimmed = text.trim().slice(0, MAX_PREFERENCES_LENGTH);
  setSetting(ctx.db, "preferences", trimmed ? { text: trimmed, updatedAt: Date.now() } : null);
  return null;
});
