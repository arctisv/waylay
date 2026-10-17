import type { LocalDatabase } from "../db";
import { AppError, mutation, query } from "../functions";
import { cancelTurnsForThread, generateThreadTitle, isMessageLive } from "../inference/turns";
import type { MessageRow, ThreadRow } from "../schema";
import { requireThread, threadMessages } from "../threads";

/** Removes a thread and everything in it. */
export function removeThread(db: LocalDatabase, threadId: string): void {
  cancelTurnsForThread(threadId);
  for (const message of threadMessages(db, threadId)) db.delete("messages", message._id);
  for (const queued of db.all("queued")) {
    if (queued.threadId === threadId) db.delete("queued", queued._id);
  }
  db.delete("threads", threadId);
}

/** One row of the thread list. */
export type ThreadSummaryRow = {
  id: string;
  title: string;
  titleStatus: "generating" | "ready";
  createdAt: number;
  updatedAt: number;
  pinnedAt: number | null;
  model: string | null;
  folderId: string | null;
  branchedFromThreadId: string | null;
  /* Kept so screens written for a hosted backend still read naturally; a
     local chat is never shared, locked or compacted. */
  compactionStatus: string;
  compactionBoundary: string | null;
  compactionUpdatedAt: number | null;
  compactionMarkers: Array<{ messageId: string; createdAt: number }>;
  shareId: string | null;
  locked: boolean;
  lockedTitle: string | null;
};

function formatThread(thread: ThreadRow): ThreadSummaryRow {
  return {
    id: thread._id,
    title: thread.title,
    titleStatus: thread.titleStatus,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    pinnedAt: thread.pinnedAt ?? null,
    model: thread.model ?? null,
    folderId: thread.folderId ?? null,
    branchedFromThreadId: thread.branchedFromThreadId ?? null,
    compactionStatus: "idle",
    compactionBoundary: null,
    compactionUpdatedAt: null,
    compactionMarkers: [],
    shareId: null,
    locked: false,
    lockedTitle: null,
  };
}

export const listForCurrentUser = query((ctx) =>
  ctx.db
    .all("threads")
    .filter((thread) => !thread.incognito)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(formatThread),
);

/** Threads with a reply being written right now. */
export const runningThreadIds = query((ctx) => {
  const running = new Set<string>();
  for (const message of ctx.db.all("messages")) {
    if (isMessageLive(message)) running.add(message.threadId);
  }
  return [...running];
});

export const updateThread = mutation((ctx, { threadId, title }: { threadId: string; title: string }) => {
  requireThread(ctx.db, threadId);
  const trimmed = title.trim();
  if (!trimmed) throw new AppError("Title cannot be empty");
  ctx.db.patch("threads", threadId, { title: trimmed, titleStatus: "ready", updatedAt: Date.now() });
  return null;
});

/** Names the chat again, from the whole conversation. */
export const regenerateTitle = mutation((ctx, { threadId }: { threadId: string }) => {
  requireThread(ctx.db, threadId);
  ctx.db.patch("threads", threadId, { titleStatus: "generating" });
  void generateThreadTitle(threadId, { fromTranscript: true });
  return null;
});

export const setPinned = mutation((ctx, { threadId, pinned }: { threadId: string; pinned: boolean }) => {
  requireThread(ctx.db, threadId);
  ctx.db.patch("threads", threadId, { pinnedAt: pinned ? Date.now() : undefined });
  return null;
});

export const setFolder = mutation(
  (ctx, { threadId, folderId }: { threadId: string; folderId: string | null }) => {
    requireThread(ctx.db, threadId);
    if (folderId && !ctx.db.get("folders", folderId)) throw new AppError("That folder doesn't exist anymore.");
    ctx.db.patch("threads", threadId, { folderId: folderId ?? undefined });
    return null;
  },
);

export const deleteThread = mutation((ctx, { threadId }: { threadId: string }) => {
  if (ctx.db.get("threads", threadId)) removeThread(ctx.db, threadId);
  return null;
});

/** Deletes every chat and its folders. Memories and settings stay. */
export const deleteAll = mutation((ctx) => {
  const threads = ctx.db.all("threads");
  for (const thread of threads) removeThread(ctx.db, thread._id);
  for (const folder of ctx.db.all("folders")) ctx.db.delete("folders", folder._id);
  return { deleted: threads.length };
});

/** Wipes one incognito chat, or every one when no id is given. */
export const purgeIncognito = mutation((ctx, args: { threadId?: string }) => {
  const targets = ctx.db
    .all("threads")
    .filter((thread) => thread.incognito && (!args?.threadId || thread._id === args.threadId));
  for (const thread of targets) removeThread(ctx.db, thread._id);
  return { purged: targets.length };
});

/** Copies the chat up to a message into a new chat, leaving the original alone. */
export const branchThread = mutation(
  (ctx, { threadId, messageId }: { threadId: string; messageId: string }) => {
    const source = requireThread(ctx.db, threadId);
    const messages = threadMessages(ctx.db, threadId);
    const checkpoint = messages.findIndex((message) => message._id === messageId);
    if (checkpoint === -1) throw new AppError("That message doesn't exist anymore.");

    const now = Date.now();
    const newThreadId = ctx.db.insert("threads", {
      title: source.title,
      titleStatus: "ready",
      createdAt: now,
      updatedAt: now,
      model: source.model,
      folderId: source.folderId,
      branchedFromThreadId: threadId,
    });
    messages.slice(0, checkpoint + 1).forEach((message, index) => {
      const copy: Partial<MessageRow> = { ...message };
      delete copy._id;
      delete copy.streamId;
      ctx.db.insert("messages", {
        ...(copy as Omit<MessageRow, "_id">),
        threadId: newThreadId,
        status: isMessageLive(message) ? "stopped" : message.status,
        createdAt: now + index,
        updatedAt: now + index,
      });
    });
    return { threadId: newThreadId };
  },
);

/** Deletes everything after a message. */
export const rollbackToMessage = mutation(
  (ctx, { threadId, messageId }: { threadId: string; messageId: string }) => {
    requireThread(ctx.db, threadId);
    const messages = threadMessages(ctx.db, threadId);
    const checkpoint = messages.findIndex((message) => message._id === messageId);
    if (checkpoint === -1) throw new AppError("That message doesn't exist anymore.");
    cancelTurnsForThread(threadId);
    for (const message of messages.slice(checkpoint + 1)) ctx.db.delete("messages", message._id);
    ctx.db.patch("threads", threadId, { updatedAt: Date.now() });
    return null;
  },
);
