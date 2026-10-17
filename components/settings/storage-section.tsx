"use client";

import { useCallback, useEffect, useState } from "react";
import { IconMicrophoneFilled } from "@tabler/icons-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/local/api";
import { LOCAL_MODELS } from "@/lib/local/inference/models";
import { useMutation } from "@/lib/local/react";
import {
  deleteModelDownload,
  deleteSpeechModel,
  eraseEverything,
  formatBytes,
  isModelDownloaded,
  isSpeechModelDownloaded,
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

type ModelKey = keyof typeof LOCAL_MODELS;

const MODEL_KEYS = Object.keys(LOCAL_MODELS) as ModelKey[];

/* Downloads and data, all of it in this browser. Each model shows whether
   it's on the device and can be deleted to free space — it downloads again
   the next time someone picks it. */
export function StorageSection() {
  const [downloaded, setDownloaded] = useState<Partial<Record<ModelKey | "voice", boolean>>>({});
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"chats" | "everything" | null>(null);
  const deleteAllChats = useMutation(api.threads.deleteAll);

  const refresh = useCallback(async () => {
    const [models, voice, estimate] = await Promise.all([
      Promise.all(MODEL_KEYS.map((key) => isModelDownloaded(LOCAL_MODELS[key]))),
      isSpeechModelDownloaded(),
      storageEstimate(),
    ]);
    setDownloaded({
      ...Object.fromEntries(MODEL_KEYS.map((key, index) => [key, models[index]])),
      voice,
    });
    setUsage(estimate);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = async (key: ModelKey | "voice") => {
    setBusy(key);
    try {
      if (key === "voice") await deleteSpeechModel();
      else await deleteModelDownload(LOCAL_MODELS[key]);
      await refresh();
    } catch {
      showToast("Couldn't delete that download. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const status = (key: ModelKey | "voice", size: string) => {
    const state = downloaded[key];
    if (state === undefined) return size;
    return state ? `${size} · On this device` : `${size} · Downloads when used`;
  };

  const removeControl = (key: ModelKey | "voice", label: string) => {
    if (busy === key) return <Spinner />;
    if (!downloaded[key]) return null;
    return (
      <ArmRemoveButton
        label={label}
        confirmLabel="Delete?"
        disabled={busy !== null}
        onRemove={() => void remove(key)}
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
            {MODEL_KEYS.map((key) => {
              const local = LOCAL_MODELS[key];
              const chatModel = CHAT_MODELS.find((model) => model.key === key)!;
              return (
                <SettingsRow
                  key={key}
                  icon={chatModel.icon}
                  title={`${chatModel.name} · ${local.label}`}
                  description={status(key, formatBytes(local.downloadMB * 1024 * 1024))}
                  control={removeControl(key, chatModel.name)}
                />
              );
            })}
            <SettingsRow
              icon={IconMicrophoneFilled}
              title="Voice · Whisper Base"
              description={status("voice", "80 MB")}
              control={removeControl("voice", "voice model")}
            />
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
