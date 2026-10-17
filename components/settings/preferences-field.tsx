"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/local/profile";
import { useMutation, useQuery } from "@/lib/local/react";
import { api } from "@/lib/local/api";

import { showToast } from "@/lib/toasts";
import { SettingsRow } from "./settings-rows";

/* Mirrors the backend's MAX_PREFERENCES_LENGTH (lib/local/backend/preferences.ts). */
const MAX_PREFERENCES_LENGTH = 2000;

/* Free-text "tell the AI about yourself" field. Saves on blur; the text is
   injected into the model's system prompt as explicit user preferences.
   Stored on this device only. */
export function PreferencesField() {
  const { user } = useUser();
  const stored = useQuery(api.preferences.getPreferences, user ? {} : "skip");
  const save = useMutation(api.preferences.setPreferences);

  const [text, setText] = useState<string | null>(null);
  const savingRef = useRef(false);

  /* Seed local state once the stored value loads; never clobber
     in-progress edits. */
  useEffect(() => {
    if (text === null && stored !== undefined) {
      setText(stored?.text ?? "");
    }
  }, [stored, text]);

  if (!user) return null;

  const commit = async () => {
    if (text === null || savingRef.current) return;
    const trimmed = text.trim();
    if (trimmed === (stored?.text ?? "")) return;

    savingRef.current = true;
    try {
      await save({ text: trimmed });
    } catch {
      showToast("Couldn't save your preferences. Try again.");
    } finally {
      savingRef.current = false;
    }
  };

  return (
    <SettingsRow
      title="Your preferences"
      description="Anything Waylay should know about you — tone, interests, how you like answers. Applied to every conversation."
    >
      <textarea
        value={text ?? ""}
        onChange={(event) =>
          setText(event.target.value.slice(0, MAX_PREFERENCES_LENGTH))
        }
        onBlur={() => void commit()}
        disabled={text === null}
        rows={5}
        maxLength={MAX_PREFERENCES_LENGTH}
        placeholder="e.g. I'm a med student, keep explanations short, no emojis please"
        className="w-full resize-y bg-well px-3 py-2.5 text-[13px]/5 shadow-[inset_0_0_0_1px_var(--well-outline),inset_0_1px_0_0_var(--well-highlight)] outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      />
      {text !== null && text.length >= MAX_PREFERENCES_LENGTH - 200 && (
        <p className="mt-1 text-right text-[11px]/4 tabular-nums text-muted-foreground">
          {text.length} / {MAX_PREFERENCES_LENGTH}
        </p>
      )}
    </SettingsRow>
  );
}
