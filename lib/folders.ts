"use client";

import { useMemo } from "react";
import { useMutation, useQuery } from "@/lib/local/react";
import type { FunctionReturnType } from "@/lib/local/functions";
import { api } from "@/lib/local/api";
import type { Id } from "@/lib/local/data-model";


export type FolderSummary = FunctionReturnType<
  typeof api.folders.listForCurrentUser
>[number];

/* Sorted by user order in the backend. `undefined` while loading. */
export function useFolders(enabled: boolean): FolderSummary[] | undefined {
  return useQuery(api.folders.listForCurrentUser, enabled ? {} : "skip");
}

export function useFolderActions() {
  const createFolder = useMutation(api.folders.createFolder);
  const renameFolder = useMutation(api.folders.renameFolder);
  const deleteFolder = useMutation(api.folders.deleteFolder);

  return useMemo(
    () => ({
      create: async (name: string) => {
        const result = await createFolder({ name });
        return result;
      },
      rename: async (folderId: Id<"folders">, name: string) => {
        await renameFolder({ folderId, name });
      },
      /* Threads inside survive — the backend un-files them. */
      remove: async (folderId: Id<"folders">) => {
        await deleteFolder({ folderId });
      },
    }),
    [createFolder, renameFolder, deleteFolder],
  );
}

/* Thread drag-and-drop plumbing. The payload rides module state instead of
   dataTransfer because dragover can't read the data — only drop can. */
export const THREAD_DRAG_TYPE = "application/x-waylay-thread-id";

export type ThreadDrag = {
  threadId: Id<"threads">;
  folderId: Id<"folders"> | null;
};

let currentThreadDrag: ThreadDrag | null = null;

export function beginThreadDrag(drag: ThreadDrag) {
  currentThreadDrag = drag;
}

export function getThreadDrag(): ThreadDrag | null {
  return currentThreadDrag;
}

export function endThreadDrag() {
  currentThreadDrag = null;
}

/* Which folders are collapsed, persisted locally like the sidebar geometry
   (same key as the main app, so the preference carries over). */
const COLLAPSED_KEY = "sidebar-folders-collapsed";

export function readCollapsedFolders(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function persistCollapsedFolders(collapsed: ReadonlySet<string>) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
  } catch {
    /* Storage may be unavailable; collapsing still works for the session. */
  }
}
