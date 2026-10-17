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
import type { SupportReport, SupportStatus } from "@/lib/local/device/types";
import { showToast } from "@/lib/toasts";

/* Waylay runs its models on this device: on the GPU through WebGPU, or —
   slower, with a smaller model — on the processor. A pill above the
   composer says when it's on the processor or can't run at all, and opens
   a dialog with the why and what to do; a send opens the same dialog
   instead of failing. */

type Notice = "unsupported-browser" | "unsupported-device" | "cpu";

const COPY: Record<
  Notice,
  { pill: string; title: string; description: string; icon: typeof IconCpu }
> = {
  "unsupported-browser": {
    pill: "This browser can't run Waylay",
    title: "This browser can't run Waylay",
    description:
      "Waylay runs its AI right on your device, and this browser is missing what it needs to do that. Open Waylay in the latest Chrome, Edge, Firefox or Safari.",
    icon: IconWorldOff,
  },
  "unsupported-device": {
    pill: "This device can't run Waylay",
    title: "This device can't run Waylay",
    description:
      "Waylay runs its AI right on your device, and this one doesn't have enough memory for even the smallest model. A recent laptop, desktop or phone will work.",
    icon: IconCpu,
  },
  cpu: {
    pill: "Running on CPU",
    title: "Running on your processor",
    description:
      "This browser can't reach your graphics chip, so Waylay runs a smaller model, Qwen 2.5 0.5B, on the processor instead. Replies are slower and simpler. For the full models, open Waylay in the latest Chrome, Edge or Safari.",
    icon: IconCpu,
  },
};

function isUnsupported(
  status: SupportStatus,
): status is "unsupported-browser" | "unsupported-device" {
  return status === "unsupported-browser" || status === "unsupported-device";
}

function noticeFor(report: SupportReport): Notice | null {
  if (isUnsupported(report.status)) return report.status;
  return report.backend === "cpu" ? "cpu" : null;
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
  const notice = noticeFor(useDeviceSupport());
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
      {notice && (
        <>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            /* The dock it sits in passes pointers through; the pill takes them. */
            className={`pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${
              notice === "cpu"
                ? "bg-black/[0.05] text-muted-foreground dark:bg-white/[0.06]"
                : "bg-orange-500/12 text-orange-700 dark:text-orange-300"
            }`}
          >
            {(() => {
              const Icon = COPY[notice].icon;
              return <Icon size={12} />;
            })()}
            {COPY[notice].pill}
          </button>
          <NoticeDialog notice={notice} open={open} />
        </>
      )}
    </div>
  );
}

function NoticeDialog({ notice, open }: { notice: Notice; open: boolean }) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const copy = COPY[notice];

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
    const next = noticeFor(report);
    if (next === null) {
      setDialogOpen(false);
      showToast("All set — Waylay runs on your GPU here now.");
    } else if (next !== notice) {
      setDialogOpen(false);
      showToast("Waylay can run here now, on the processor.");
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
