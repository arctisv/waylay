"use client";

import { useMemo } from "react";
import type { OptimisticLocalStore } from "@/lib/local/react";
import { useMutation, useQuery } from "@/lib/local/react";
import type { FunctionReturnType } from "@/lib/local/functions";
import { api } from "@/lib/local/api";
import type { Id } from "@/lib/local/data-model";

import { requestDelete, usePendingDeleteIds } from "./toasts";

export type ThreadSummary = FunctionReturnType<
  typeof api.threads.listForCurrentUser
>[number];

export const PINNED_GROUP = "Pinned";

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/* Same buckets and labels as the main app. */
export function formatThreadGroup(updatedAt: number): string {
  const todayStart = startOfDay(new Date());
  const updatedStart = startOfDay(new Date(updatedAt));
  const dayDiff = Math.round((todayStart - updatedStart) / 86_400_000);
  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff <= 7) return "Previous 7 days";
  if (dayDiff <= 30) return "Previous 30 days";
  return "Older";
}

/* Pinned first (freshest pin wins), then by last activity. */
function compareThreads(a: ThreadSummary, b: ThreadSummary) {
  if (a.pinnedAt !== null && b.pinnedAt !== null) return b.pinnedAt - a.pinnedAt;
  if (a.pinnedAt !== null) return -1;
  if (b.pinnedAt !== null) return 1;
  return b.updatedAt - a.updatedAt;
}

/* All threads, sorted, minus ones hidden by a ticking delete toast.
   `undefined` while loading (or while skipped — callers gate on the local
   session).

   Nothing here moves during a turn — see the note on the query. Whether a
   thread is live is a separate subscription (useRunningThreadIds), so a
   reply streaming in doesn't hand this list a new identity thirty times a
   second and re-render every row that reads it. */
export function useThreads(enabled: boolean): ThreadSummary[] | undefined {
  const raw = useQuery(api.threads.listForCurrentUser, enabled ? {} : "skip");
  const pendingDeleteIds = usePendingDeleteIds();
  return useMemo(() => {
    if (!raw) return undefined;
    return raw
      .filter((thread) => !pendingDeleteIds.has(thread.id))
      .sort(compareThreads);
  }, [raw, pendingDeleteIds]);
}

const NO_RUNNING_THREADS: ReadonlySet<string> = new Set();

/* The threads with a turn in flight. Tiny and churning, where the listing
   above is large and still. */
export function useRunningThreadIds(enabled: boolean): ReadonlySet<string> {
  const ids = useQuery(api.threads.runningThreadIds, enabled ? {} : "skip");
  return useMemo(
    () => (ids && ids.length > 0 ? new Set(ids) : NO_RUNNING_THREADS),
    [ids],
  );
}

/* Split folder members out; threads pointing at a deleted folder fall back
   to the loose list so they never vanish. Generic so the cached-snapshot
   skeleton can reuse the exact same layout logic. */
export function partitionThreadsByFolder<
  T extends { folderId: string | null },
>(threads: T[], folderIds: ReadonlySet<string>) {
  const byFolder = new Map<string, T[]>();
  const loose: T[] = [];
  for (const thread of threads) {
    if (thread.folderId && folderIds.has(thread.folderId)) {
      const members = byFolder.get(thread.folderId) ?? [];
      members.push(thread);
      byFolder.set(thread.folderId, members);
    } else {
      loose.push(thread);
    }
  }
  return { byFolder, loose };
}

/* Collapse the (already sorted) list into contiguous [label, threads] runs —
   pinned threads surface as one "Pinned" run at the top. */
export function groupThreads<
  T extends { pinnedAt: number | null; updatedAt: number },
>(threads: T[]): Array<[string, T[]]> {
  const groups: Array<[string, T[]]> = [];
  for (const thread of threads) {
    const label =
      thread.pinnedAt !== null ? PINNED_GROUP : formatThreadGroup(thread.updatedAt);
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(thread);
    else groups.push([label, [thread]]);
  }
  return groups;
}

function patchThread(
  store: OptimisticLocalStore,
  threadId: Id<"threads">,
  patch: Partial<ThreadSummary>,
) {
  const current = store.getQuery(api.threads.listForCurrentUser, {});
  if (!current) return;
  store.setQuery(
    api.threads.listForCurrentUser,
    {},
    current.map((thread) =>
      thread.id === threadId ? { ...thread, ...patch } : thread,
    ),
  );
}

export function useThreadActions() {
  const updateThread = useMutation(
    api.threads.updateThread,
  ).withOptimisticUpdate((store, args) => {
    patchThread(store, args.threadId, {
      title: args.title,
      titleStatus: "ready",
      // Optimistic updaters run outside render — locally, not at all.
      // eslint-disable-next-line react-hooks/purity
      updatedAt: Date.now(),
    });
  });
  /* The mutation flags the shimmer in the same tick as the click, and
     the backend clears it whichever way the model goes. */
  const regenerateTitleMutation = useMutation(
    api.threads.regenerateTitle,
  ).withOptimisticUpdate((store, args) => {
    patchThread(store, args.threadId, { titleStatus: "generating" });
  });
  const setPinnedMutation = useMutation(
    api.threads.setPinned,
  ).withOptimisticUpdate((store, args) => {
    patchThread(store, args.threadId, {
      // Optimistic updaters run outside render — locally, not at all.
      // eslint-disable-next-line react-hooks/purity
      pinnedAt: args.pinned ? Date.now() : null,
    });
  });
  const setFolderMutation = useMutation(
    api.threads.setFolder,
  ).withOptimisticUpdate((store, args) => {
    patchThread(store, args.threadId, { folderId: args.folderId });
  });
  const deleteThreadMutation = useMutation(
    api.threads.deleteThread,
  ).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.threads.listForCurrentUser, {});
    if (!current) return;
    store.setQuery(
      api.threads.listForCurrentUser,
      {},
      current.filter((thread) => thread.id !== args.threadId),
    );
  });

  return useMemo(
    () => ({
      rename: async (threadId: Id<"threads">, title: string) => {
        await updateThread({ threadId, title });
      },
      /* Re-names the thread from the whole conversation, not just its
         opening message. */
      regenerateTitle: async (threadId: Id<"threads">) => {
        await regenerateTitleMutation({ threadId });
      },
      setPinned: async (threadId: Id<"threads">, pinned: boolean) => {
        await setPinnedMutation({ threadId, pinned });
      },
      setFolder: async (
        threadId: Id<"threads">,
        folderId: Id<"folders"> | null,
      ) => {
        await setFolderMutation({ threadId, folderId });
      },
      /* Hidden immediately; the hard delete only fires if the undo
         window on the toast runs out. */
      requestDelete: (thread: Pick<ThreadSummary, "id" | "title">) =>
        requestDelete({
          id: thread.id,
          message: `Deleted "${thread.title}"`,
          errorMessage: `Couldn't delete "${thread.title}". Try again.`,
          commit: async () => {
            await deleteThreadMutation({ threadId: thread.id });
          },
        }),
    }),
    [
      updateThread,
      regenerateTitleMutation,
      setPinnedMutation,
      setFolderMutation,
      deleteThreadMutation,
    ],
  );
}
