"use client";

import { useMemories } from "@/lib/user-memory";
import { SettingsCard, SettingsHeader, SettingsRow } from "../settings-rows";
import { ForgetEverythingCard } from "./forget-everything-card";
import { MemoriesCard } from "./memories-card";
import { MemoryToggle } from "./memory-toggle";

/* The Memory tab. The switch up top decides whether Waylay reads or writes
   memory at all; everything under it manages what's already stored, which
   matters just as much when the switch is off. All of it lives on this
   device. */

export function MemorySection() {
  const memories = useMemories(true);

  return (
    <>
      <SettingsHeader
        title="Memory"
        description="What Waylay carries from one chat to the next, kept on this device."
      />
      {/* Roomy gaps: each group is heading + card, and the whitespace is
          what tells them apart. */}
      <div className="flex flex-col gap-9">
        <SettingsCard>
          <SettingsRow
            title="Use memory"
            description="Let Waylay draw on what it knows about you and save new things as you chat. Turning it off pauses both — nothing already saved is deleted."
            control={<MemoryToggle />}
          />
        </SettingsCard>

        <MemoriesCard store={memories} />
        <ForgetEverythingCard onCleared={() => memories.clear()} />
      </div>
    </>
  );
}
