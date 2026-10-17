"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@/lib/local/react";
import type { FunctionReturnType } from "@/lib/local/functions";
import { api } from "@/lib/local/api";
import type { Id } from "@/lib/local/data-model";

import type { AttachmentUpload } from "./attachments";
import { lineupKey, type ThinkingLevel } from "./models";

/* Messages typed while a reply was still being written. They wait in the
   local database, not in the composer (lib/local/backend/messageQueue.ts):
   the backend sends each one the moment the reply ahead of it settles, so
   the thread keeps going whether or not it's the one on screen. This file
   is the subscription and the two writes; the transcript draws the rows. */

export type QueuedMessage = FunctionReturnType<
  typeof api.messageQueue.listForThread
>[number];

const NO_QUEUED: QueuedMessage[] = [];

/** The thread's waiting messages, oldest first. Empty while loading. */
export function useQueuedMessages(
  threadId: string | null,
  enabled: boolean,
): QueuedMessage[] {
  const rows = useQuery(
    api.messageQueue.listForThread,
    enabled && threadId ? { threadId: threadId as Id<"threads"> } : "skip",
  );
  return rows ?? NO_QUEUED;
}

export type QueueMessageArgs = {
  threadId: string;
  text: string;
  model: string;
  attachments: AttachmentUpload[];
  thinking: ThinkingLevel;
};


/* Same folding a send does: a model in the lineup, or Auto. */
const wireModel = lineupKey;

export function useQueueActions() {
  const enqueueBase = useMutation(api.messageQueue.enqueue);
  /* Optimistic, so the card lands under the streaming reply on the
     keypress. The placeholder carries a made-up id; the echo replaces it
     wholesale, and the card is keyed on content + position so React
     carries the node across the swap instead of remounting it. */
  const enqueue = useMemo(
    () =>
      enqueueBase.withOptimisticUpdate((store, args) => {
        const { threadId } = args;
        const current = store.getQuery(api.messageQueue.listForThread, {
          threadId,
        });
        if (!current) return;
        // Optimistic updaters run outside render — locally, not at all.
        // eslint-disable-next-line react-hooks/purity
        const now = Date.now();
        store.setQuery(api.messageQueue.listForThread, { threadId }, [
          ...current,
          {
            id: `optimistic:${now}` as Id<"queuedMessages">,
            content: args.content,
            createdAt: now,
            attachments: (args.attachments ?? []).map(
              ({ id, name, size, type }) => ({ id, name, size, type }),
            ),
            model: args.options?.model ?? null,
          },
        ]);
      }),
    [enqueueBase],
  );

  const removeBase = useMutation(api.messageQueue.remove);
  const remove = useMemo(
    () =>
      removeBase.withOptimisticUpdate((store, args) => {
        /* The query is keyed by thread and the mutation only knows the
           row, so every loaded queue gets the row filtered out — a
           removal touches exactly one of them. */
        for (const { args: queryArgs, value } of store.getAllQueries(
          api.messageQueue.listForThread,
        )) {
          if (!value?.some((row) => row.id === args.queuedId)) continue;
          store.setQuery(
            api.messageQueue.listForThread,
            queryArgs,
            value.filter((row) => row.id !== args.queuedId),
          );
        }
      }),
    [removeBase],
  );

  const queue = useCallback(
    async ({
      threadId,
      text,
      model,
      attachments,
      thinking,
    }: QueueMessageArgs) => {
      const result = await enqueue({
        threadId: threadId as Id<"threads">,
        content: text,
        ...(attachments.length > 0
          ? {
              attachments: attachments.map((file) => ({
                id: file.id,
                name: file.name,
                size: file.size,
                type: file.type,
                ...(file.text !== undefined ? { text: file.text } : {}),
                ...(file.skippedReason !== undefined
                  ? { skippedReason: file.skippedReason }
                  : {}),
              })),
            }
          : {}),
        options: {
          thinking: thinking !== "none",
          model: wireModel(model),
        },
      });
      return result;
    },
    [enqueue],
  );

  const dequeue = useCallback(
    async (queuedId: string) => {
      await remove({ queuedId: queuedId as Id<"queuedMessages"> });
    },
    [remove],
  );

  return useMemo(() => ({ queue, dequeue }), [queue, dequeue]);
}
