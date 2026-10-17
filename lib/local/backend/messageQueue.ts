import { AppError, mutation, query } from "../functions";
import type { AttachmentRow, QueuedRow, SendOptions } from "../schema";
import { drainQueue, isMessageLive } from "../inference/turns";
import { requireThread, threadMessages } from "../threads";

/* Messages typed while a reply was still being written. They wait here and
   go out, oldest first, the moment the reply ahead settles (see
   drainQueue in ../inference/turns.ts). */

const MAX_QUEUED_PER_THREAD = 10;

function formatQueued(row: QueuedRow) {
  return {
    id: row._id,
    content: row.content,
    createdAt: row.createdAt,
    attachments: (row.attachments ?? []).map(({ id, name, size, type }) => ({ id, name, size, type })),
    model: row.options?.model ?? null,
  };
}

export const listForThread = query((ctx, { threadId }: { threadId: string }) =>
  ctx.db
    .all("queued")
    .filter((row) => row.threadId === threadId)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(formatQueued),
);

export const enqueue = mutation(
  (
    ctx,
    {
      threadId,
      content,
      attachments,
      options,
    }: { threadId: string; content: string; attachments?: AttachmentRow[]; options?: SendOptions },
  ) => {
    requireThread(ctx.db, threadId);
    const waiting = ctx.db.all("queued").filter((row) => row.threadId === threadId);
    if (waiting.length >= MAX_QUEUED_PER_THREAD) {
      throw new AppError(`You can queue up to ${MAX_QUEUED_PER_THREAD} messages. Let the reply catch up first.`);
    }
    const queuedId = ctx.db.insert("queued", { threadId, content, attachments, options, createdAt: Date.now() });
    /* The reply may have finished between the composer's check and this
       write: then there's nothing to wait for, and the message goes now. */
    const idle = !threadMessages(ctx.db, threadId).some(isMessageLive);
    if (idle) drainQueue(threadId);
    return { queuedId, sentNow: idle };
  },
);

export const remove = mutation((ctx, { queuedId }: { queuedId: string }) => {
  ctx.db.delete("queued", queuedId);
  return null;
});
