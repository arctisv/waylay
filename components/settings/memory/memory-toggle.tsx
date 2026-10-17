"use client";

import { useMutation, useQuery } from "@/lib/local/react";
import { api } from "@/lib/local/api";

import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/lib/toasts";
import { ToggleSwitch } from "../../toggle-switch";

/* The memory master switch. Memory is always available on this device, so
   there's no plan gate here. An absent setting reads as on, matching the
   backend default (lib/local/settings.ts). */
export function MemoryToggle() {
  const settings = useQuery(api.memory.getMemorySettings, {});
  const setEnabled = useMutation(api.memory.setMemoryEnabled);

  if (settings === undefined) {
    return <Skeleton className="h-4.5 w-8"/>;
  }

  const toggle = async (next: boolean) => {
    try {
      await setEnabled({ enabled: next });
    } catch {
      showToast("Couldn't update memory. Try again.");
    }
  };

  return (
    <ToggleSwitch
      checked={settings.enabled}
      onCheckedChange={(next) => void toggle(next)}
      aria-label="Use memory"
    />
  );
}
