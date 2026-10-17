"use client";

import { useCallback, useRef, useState } from "react";
import {
  getAttachmentType,
  makeAttachmentId,
  prepareAttachment,
  type AttachmentUpload,
} from "@/lib/attachments";

/* Draft lifecycle for composer attachments: every picked file starts
   reading immediately and tracks its state on a draft; send calls
   resolve() to wait out anything still being read. Whether a draft is
   *acceptable* is not tracked here — that's model-relative and re-checked at render
   (attachmentRejectionReason). */

export type AttachmentDraft = {
  id: string;
  name: string;
  size: number;
  type: string;
  /** `uploading` is the moment the file is being read in the browser. */
  status: "uploading" | "reading" | "ready" | "error";
  /** Read progress, 0..1. Sits at 1 once ready. */
  progress: number;
  /** Object URL for image previews — revoked on remove/clear. */
  previewUrl?: string;
  error?: string;
  upload?: AttachmentUpload;
};

export function useAttachments() {
  const [drafts, setDrafts] = useState<AttachmentDraft[]>([]);
  /* Write-through mirror so resolve() reads the post-settle truth without
     waiting for a render, plus the in-flight jobs it awaits. */
  const draftsRef = useRef<AttachmentDraft[]>([]);
  const pendingRef = useRef(new Map<string, Promise<void>>());

  const commit = useCallback(
    (updater: (prev: AttachmentDraft[]) => AttachmentDraft[]) => {
      setDrafts((prev) => {
        const next = updater(prev);
        draftsRef.current = next;
        return next;
      });
    },
    [],
  );

  const patch = useCallback(
    (id: string, updates: Partial<AttachmentDraft>) => {
      commit((prev) =>
        prev.map((draft) =>
          draft.id === id ? { ...draft, ...updates } : draft,
        ),
      );
    },
    [commit],
  );

  const addFiles = useCallback(
    (files: Iterable<File>) => {
      for (const file of files) {
        const id = makeAttachmentId();
        const type = getAttachmentType(file);
        const previewUrl = type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined;
        commit((prev) => [
          ...prev,
          {
            id,
            name: file.name,
            size: file.size,
            type,
            status: "uploading",
            progress: 0,
            previewUrl,
          },
        ]);

        const job = (async () => {
          try {
            const upload = await prepareAttachment(file);
            patch(id, {
              status: "ready",
              progress: 1,
              upload,
              name: upload.name,
              size: upload.size,
              type: upload.type,
            });
          } catch (error) {
            patch(id, {
              status: "error",
              error:
                error instanceof Error ? error.message : "Couldn't read that file.",
            });
          } finally {
            pendingRef.current.delete(id);
          }
        })();
        pendingRef.current.set(id, job);
      }
    },
    [commit, patch],
  );

  const remove = useCallback(
    (id: string) => {
      const target = draftsRef.current.find((draft) => draft.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      pendingRef.current.delete(id);
      commit((prev) => prev.filter((draft) => draft.id !== id));
    },
    [commit],
  );

  const clear = useCallback(() => {
    for (const draft of draftsRef.current) {
      if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    }
    pendingRef.current.clear();
    commit(() => []);
  }, [commit]);

  /** Wait for every in-flight upload, then hand back the ready uploads in
   * tray order. Errored drafts stay behind on screen. */
  const resolve = useCallback(async (): Promise<AttachmentUpload[]> => {
    await Promise.allSettled([...pendingRef.current.values()]);
    return draftsRef.current
      .map((draft) => draft.upload)
      .filter((upload): upload is AttachmentUpload => upload !== undefined);
  }, []);

  return { drafts, addFiles, remove, clear, resolve };
}
