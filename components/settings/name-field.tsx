"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/local/api";
import { useMutation, useQuery } from "@/lib/local/react";
import { showToast } from "@/lib/toasts";
import { SettingsRow } from "./settings-rows";

const MAX_NAME_LENGTH = 60;

/* What Waylay calls you — the home greeting and the model both use it.
   Saves on blur, like the preferences field. */
export function NameField() {
  const profile = useQuery(api.profile.get, {});
  const save = useMutation(api.profile.setName);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (text === null && profile !== undefined) setText(profile.name ?? "");
  }, [profile, text]);

  const commit = async () => {
    if (text === null) return;
    if (text.trim() === (profile?.name ?? "")) return;
    try {
      await save({ name: text });
    } catch {
      showToast("Couldn't save your name. Try again.");
    }
  };

  return (
    <SettingsRow
      title="Your name"
      description="What Waylay calls you. Stays on this device."
    >
      <input
        value={text ?? ""}
        onChange={(event) => setText(event.target.value.slice(0, MAX_NAME_LENGTH))}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        disabled={text === null}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="given-name"
        placeholder="e.g. Sam"
        aria-label="Your name"
        className="h-9 w-full rounded-lg bg-well px-3 text-[13px]/5 shadow-[inset_0_0_0_1px_var(--well-outline),inset_0_1px_0_0_var(--well-highlight)] outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      />
    </SettingsRow>
  );
}
