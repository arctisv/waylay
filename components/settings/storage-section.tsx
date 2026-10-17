"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconCpu,
  IconMicrophoneFilled,
  IconPhotoFilled,
  type Icon,
} from "@tabler/icons-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/local/api";
import { IMAGE_MODEL } from "@/lib/local/inference/image-engine";
import { CPU_MODEL, LOCAL_MODELS, type TextModelKey } from "@/lib/local/inference/models";
import { useMutation } from "@/lib/local/react";
import { SPEECH_MODEL } from "@/lib/local/speech/model";
import {
  deleteModelDownload,
  deleteRepoDownload,
  eraseEverything,
  formatBytes,
  isModelDownloaded,
  isRepoDownloaded,
  storageEstimate,
} from "@/lib/local/storage";
import { CHAT_MODELS } from "@/lib/models";
import { showToast } from "@/lib/toasts";
import { ArmRemoveButton } from "./arm-remove-button";
import {
  SettingsCard,
  SettingsGroupHeader,
  SettingsHeader,
  SettingsRow,
} from "./settings-rows";

/** One downloadable model, as the Downloads card lists it. */
type Download = {
  key: string;
  icon: Icon;
  title: string;
  /** Short name for the delete button's label. */
  name: string;
  sizeMB: number;
  isDownloaded: () => Promise<boolean>;
  remove: () => Promise<void>;
};

const TEXT_KEYS = Object.keys(LOCAL_MODELS) as TextModelKey[];

const DOWNLOADS: Download[] = [
  ...TEXT_KEYS.map((key): Download => {
    const local = LOCAL_MODELS[key];
    const chatModel = CHAT_MODELS.find((model) => model.key === key)!;
    return {
      key,
      icon: chatModel.icon,
      title: `${chatModel.name} · ${local.label}`,
      name: chatModel.name,
      sizeMB: local.downloadMB,
      isDownloaded: () => isModelDownloaded(local),
      remove: () => deleteModelDownload(local),
    };
  }),
  {
    key: "image",
    icon: IconPhotoFilled,
    title: `Image · ${IMAGE_MODEL.label}`,
    name: "image model",
    sizeMB: IMAGE_MODEL.downloadMB,
    isDownloaded: () => isRepoDownloaded(IMAGE_MODEL.repo),
    remove: () => deleteRepoDownload(IMAGE_MODEL.repo),
  },
  {
    key: "cpu",
    icon: IconCpu,
    title: `Processor · ${CPU_MODEL.label}`,
    name: "processor model",
    sizeMB: CPU_MODEL.downloadMB,
    isDownloaded: () => isRepoDownloaded(CPU_MODEL.repo),
    remove: () => deleteRepoDownload(CPU_MODEL.repo),
  },
  {
    key: "voice",
    icon: IconMicrophoneFilled,
    title: `Voice · ${SPEECH_MODEL.label}`,
    name: "voice model",
    sizeMB: SPEECH_MODEL.downloadMB,
    isDownloaded: () => isRepoDownloaded(SPEECH_MODEL.repo),
    remove: () => deleteRepoDownload(SPEECH_MODEL.repo),
  },
];

/** Which models are on the device, and how much space the site uses. */
async function readStorage() {
  const [states, usage] = await Promise.all([
    Promise.all(DOWNLOADS.map((download) => download.isDownloaded())),
    storageEstimate(),
  ]);
  return {
    downloaded: Object.fromEntries(
      DOWNLOADS.map((download, index) => [download.key, states[index]]),
    ) as Record<string, boolean>,
    usage,
  };
}

/* Downloads and data, all of it in this browser. Each model shows whether
   it's on the device and can be deleted to free space — it downloads again
   the next time it's needed. */
export function StorageSection() {
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"chats" | "everything" | null>(null);
  const deleteAllChats = useMutation(api.threads.deleteAll);

  const refresh = useCallback(
    () =>
      readStorage().then((next) => {
        setDownloaded(next.downloaded);
        setUsage(next.usage);
      }),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = async (download: Download) => {
    setBusy(download.key);
    try {
      await download.remove();
      await refresh();
    } catch {
      showToast("Couldn't delete that download. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const status = (download: Download) => {
    const size = formatBytes(download.sizeMB * 1024 * 1024);
    const state = downloaded[download.key];
    if (state === undefined) return size;
    return state ? `${size} · On this device` : `${size} · Downloads when used`;
  };

  const removeControl = (download: Download) => {
    if (busy === download.key) return <Spinner />;
    if (!downloaded[download.key]) return null;
    return (
      <ArmRemoveButton
        label={download.name}
        confirmLabel="Delete?"
        disabled={busy !== null}
        onRemove={() => void remove(download)}
      />
    );
  };

  return (
    <>
      <SettingsHeader
        title="Storage"
        description="Everything Waylay keeps lives in this browser. Nothing is uploaded."
      />
      <div className="flex flex-col gap-8">
        <div>
          <SettingsGroupHeader
            title="Downloads"
            description={
              usage
                ? `Using ${formatBytes(usage.usage)} of ${formatBytes(usage.quota)} this browser allows.`
                : "Models download once, then work offline."
            }
          />
          <SettingsCard>
            {DOWNLOADS.map((download) => (
              <SettingsRow
                key={download.key}
                icon={download.icon}
                title={download.title}
                description={status(download)}
                control={removeControl(download)}
              />
            ))}
          </SettingsCard>
        </div>

        <div>
          <SettingsGroupHeader title="Your data" />
          <SettingsCard>
            <SettingsRow
              title="Delete all chats"
              description="Every conversation and folder. Memories and settings stay."
              control={
                <Button variant="outline" size="sm" onClick={() => setConfirming("chats")}>
                  Delete all
                </Button>
              }
            />
            <SettingsRow
              title="Erase everything"
              description="Chats, memories, settings and downloads. Waylay starts over as if it was never opened."
              control={
                <Button
                  variant="destructive"
                  size="sm"
                  className="min-w-[72px]"
                  disabled={busy === "everything"}
                  onClick={() => setConfirming("everything")}
                >
                  {busy === "everything" ? <Spinner /> : "Erase"}
                </Button>
              }
            />
          </SettingsCard>
        </div>
      </div>

      <ConfirmDialog
        open={confirming === "chats"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Delete all chats?"
        message="Every conversation goes for good. This can't be undone."
        confirmLabel="Delete all chats"
        destructive
        onConfirm={() => {
          void deleteAllChats({})
            .then(({ deleted }) =>
              showToast(
                deleted > 0
                  ? `Deleted ${deleted} ${deleted === 1 ? "chat" : "chats"}.`
                  : "There were no chats to delete.",
              ),
            )
            .catch(() => showToast("Couldn't delete your chats. Try again."));
        }}
      />
      <ConfirmDialog
        open={confirming === "everything"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Erase everything?"
        message="Every chat, memory, setting and download is removed from this browser. This can't be undone."
        confirmLabel="Erase everything"
        destructive
        onConfirm={() => {
          setBusy("everything");
          void eraseEverything().catch(() => {
            setBusy(null);
            showToast("Couldn't erase everything. Try again.");
          });
        }}
      />
    </>
  );
}
