"use client";

import { useState } from "react";
import { useAction } from "@/lib/local/react";
import { api } from "@/lib/local/api";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { errorText } from "@/lib/local/functions";
import { showToast } from "@/lib/toasts";
import { SettingsCard, SettingsRow } from "../settings-rows";

/* The one memory action there's no undoing, so it gets a real dialog rather
   than the arm-and-tap trash the per-row removals use. */
export function ForgetEverythingCard({
  onCleared,
}: {
  onCleared: () => void;
}) {
  const forgetEverything = useAction(api.userMemory.forgetEverything);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const wipe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { memories } = await forgetEverything({});
      onCleared();
      showToast(
        memories > 0
          ? `Forgot ${memories} ${memories === 1 ? "memory" : "memories"}.`
          : "Memory was already empty.",
      );
    } catch (error) {
      showToast(errorText(error, "Couldn't clear your memory. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SettingsCard>
        <SettingsRow
          title="Forget everything"
          description="Delete every memory. Your conversations stay put — only what Waylay learned from them goes."
          control={
            <Button
              variant="destructive"
              size="sm"
              className="min-w-[92px]"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              {busy ? <Spinner /> : "Forget all"}
            </Button>
          }
        />
      </SettingsCard>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Forget everything?"
        message="Every memory goes for good. Waylay starts over from scratch, and this can't be undone."
        confirmLabel="Forget everything"
        destructive
        onConfirm={() => void wipe()}
      />
    </>
  );
}
