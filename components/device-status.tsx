"use client";

import { useState, useSyncExternalStore } from "react";
import {
  IconCheck,
  IconCpu,
  IconLink,
  IconRefresh,
  IconWorldOff,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getDeviceSupport,
  recheckDeviceSupport,
  useDeviceSupport,
} from "@/lib/local/device/support";
import type { SupportStatus } from "@/lib/local/device/types";
import { showToast } from "@/lib/toasts";

/* Waylay runs its model on this device, through WebGPU. Where that can't
   happen, a pill above the composer says so, and opens a dialog with the
   why and what to do — the same thing a send opens instead of failing. */

const COPY: Record<
  "unsupported-browser" | "unsupported-device",
  { pill: string; title: string; description: string; icon: typeof IconCpu }
> = {
  "unsupported-browser": {
    pill: "This browser can't run Waylay",
    title: "This browser can't run Waylay",
    description:
      "Waylay runs its AI right on your device, using WebGPU to reach your graphics chip. This browser doesn't support WebGPU yet. Open Waylay in the latest Chrome, Edge or Safari.",
    icon: IconWorldOff,
  },
  "unsupported-device": {
    pill: "This device can't run Waylay",
    title: "This device can't run Waylay",
    description:
      "Waylay runs its AI right on your device, and this one's graphics or memory can't keep up with it. A recent laptop or desktop will work.",
    icon: IconCpu,
  },
};

function isUnsupported(
  status: SupportStatus,
): status is "unsupported-browser" | "unsupported-device" {
  return status === "unsupported-browser" || status === "unsupported-device";
}

/* One dialog for the app, opened from the pill or from a send. */
let dialogOpen = false;
const dialogListeners = new Set<() => void>();

function setDialogOpen(open: boolean) {
  dialogOpen = open;
  for (const listener of dialogListeners) listener();
}

/** Resolves true when a model can run here; otherwise explains why and resolves false. */
export async function ensureDeviceCanRun(): Promise<boolean> {
  const report = await getDeviceSupport();
  if (!isUnsupported(report.status)) return true;
  setDialogOpen(true);
  return false;
}

export function DeviceStatusPills() {
  const { status } = useDeviceSupport();
  const open = useSyncExternalStore(
    (listener) => {
      dialogListeners.add(listener);
      return () => {
        dialogListeners.delete(listener);
      };
    },
    () => dialogOpen,
    () => false,
  );

  return (
    <div className="mb-1.5 flex min-h-0 items-center justify-end gap-1.5">
      {isUnsupported(status) && (
        <>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1 bg-orange-500/12 px-2 py-1 text-[11px] font-medium text-orange-700 dark:text-orange-300"
          >
            {(() => {
              const Icon = COPY[status].icon;
              return <Icon size={12} />;
            })()}
            {COPY[status].pill}
          </button>
          <UnsupportedDialog status={status} open={open} />
        </>
      )}
    </div>
  );
}

function UnsupportedDialog({
  status,
  open,
}: {
  status: "unsupported-browser" | "unsupported-device";
  open: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const copy = COPY[status];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        window.location.origin + window.location.pathname,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Couldn't copy the link. Copy it from the address bar instead.");
    }
  };

  const checkAgain = async () => {
    setChecking(true);
    const report = await recheckDeviceSupport();
    setChecking(false);
    if (!isUnsupported(report.status)) {
      setDialogOpen(false);
      showToast("All set — Waylay can run here now.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className="pt-1">{copy.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => void checkAgain()} disabled={checking}>
            <IconRefresh size={15} className={checking ? "animate-spin" : undefined} />
            {checking ? "Checking…" : "Check again"}
          </Button>
          <Button onClick={() => void copyLink()}>
            {copied ? <IconCheck size={15} /> : <IconLink size={15} />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
