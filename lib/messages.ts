"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useMutation, useQuery } from "@/lib/local/react";
import { api } from "@/lib/local/api";
import type { Id } from "@/lib/local/data-model";

import { stopAssistantStream } from "./assistant-stream";
import type { AttachmentUpload } from "./attachments";
import {
  useCachedThreadMessages,
  writeThreadMessageCache,
} from "./message-cache";
import { reconcileMessageIdentities } from "./message-identity";
import { CHAT_MODELS, type ThinkingLevel } from "./models";

/* The chat data layer: sending, subscribing, stopping, retrying. The
   protocol (see lib/local/backend/messages.ts): sendUserMessage writes the
   user row plus an empty assistant row and starts the on-device turn
   (lib/local/inference/turns.ts). The reply streams in through the
   reactive getStreamBody query; final text lands on the message row when
   the turn completes, and phases (reasoning, tools) update reactively the
   whole way. */

export type MessageStatus =
  "thinking" | "searching" | "streaming" | "complete" | "stopped" | "error";

export type MessageAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  text?: string;
  skippedReason?: string;
};

export type CalcItem = {
  expression?: string;
  result?: string;
  expressionTex?: string;
  resultTex?: string;
  needsLatex?: boolean;
  error?: string;
  label?: string;
};

/* What a reply did on its way to the answer: getting the model ready
   ("model"), reasoning ("thought"), and the tools it called ("calc",
   "memory"). Rendered as compact activity rows above the prose. */
export type MessagePhase = {
  kind: string;
  pending?: boolean;
  error?: string;
  ok?: boolean;
  /** The reasoning trace, for "thought". */
  text?: string;
  durationMs?: number;
  items?: CalcItem[];
  /** Where in the reply's text this phase happened. */
  contentOffset?: number;
  /** Live status line while pending ("Downloading Llama 3.2 1B · 42%"). */
  action?: string;
  completed?: string;
  expression?: string;
  result?: string;
  expressionTex?: string;
  resultTex?: string;
  needsLatex?: boolean;
  /** A calc's short name, or the fact a "memory" phase saved. */
  label?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  /** Ciphertext when `sealed` — opened by the tab holding the thread's key
   *  (lib/locked/use-locked-thread.ts), never rendered as-is. */
  content: string;
  sealed?: boolean;
  createdAt: number;
  status?: MessageStatus;
  phases?: MessagePhase[];
  streamId?: string;
  model?: string;
  thinking?: boolean;
  search?: boolean;
  attachments?: MessageAttachment[];
  /* Reply bookkeeping for the "Show stats" chips — completion tokens
     (reasoning included) and wall-clock generation time. Absent on user
     rows and replies that never finished. */
  outputTokens?: number;
  durationMs?: number;
  /** Client-decorated marker persisted in the transcript cache. */
  compactedAt?: number;
};

export type CompactionSnapshot = {
  compactionMarkers?: Array<{ messageId: string; createdAt: number }>;
  compactionBoundary?: string | null;
  compactionUpdatedAt?: number | null;
};

export function decorateCompactionMarkers(
  messages: ChatMessage[],
  snapshot?: CompactionSnapshot,
): ChatMessage[] {
  if (!snapshot) return messages;
  const markers = new Map<string, number>();
  for (const marker of snapshot.compactionMarkers ?? []) {
    markers.set(marker.messageId, marker.createdAt);
  }
  if (
    markers.size === 0 &&
    snapshot.compactionBoundary &&
    snapshot.compactionUpdatedAt
  ) {
    markers.set(snapshot.compactionBoundary, snapshot.compactionUpdatedAt);
  }
  if (markers.size === 0) return messages;
  return messages.map((message) => {
    const compactedAt = markers.get(message.id);
    return compactedAt ? { ...message, compactedAt } : message;
  });
}

export const TERMINAL_STATUSES: ReadonlySet<MessageStatus> = new Set([
  "complete",
  "stopped",
  "error",
]);

export function isTerminal(status: MessageStatus | undefined): boolean {
  return status === undefined || TERMINAL_STATUSES.has(status);
}

/* A failed reply carries its plain-language reason in `content`
   (lib/local/inference/turns.ts writes it). */
export type MessageError = { kind: "generic"; detail?: string };

export function parseMessageError(content: string): MessageError {
  return { kind: "generic", detail: content || undefined };
}

/* ---- Pending sends -------------------------------------------------- */

/* The mutation returns real ids; until the reactive query echoes those
   rows back this bridge keeps the just-sent turn on screen. Module-level
   (mirrors lib/toasts.ts) so a settings round-trip can't drop it. */

type PendingSend = {
  threadId: string;
  user: ChatMessage;
  assistant: ChatMessage;
};

let pendingSends = new Map<string, PendingSend>();
const pendingListeners = new Set<() => void>();

function emitPending() {
  pendingSends = new Map(pendingSends);
  for (const listener of pendingListeners) listener();
}

function registerPendingSend(send: PendingSend) {
  pendingSends.set(send.threadId, send);
  emitPending();
}

/* Exported for the incognito exit path — a purged thread's echo never
   arrives, so its bridge entry has to be dropped by hand. */
export function clearPendingSend(threadId: string) {
  if (!pendingSends.has(threadId)) return;
  pendingSends.delete(threadId);
  emitPending();
}

const EMPTY_PENDING = new Map<string, PendingSend>();

function usePendingSend(threadId: string | undefined): PendingSend | undefined {
  const sends = useSyncExternalStore(
    (onStoreChange) => {
      pendingListeners.add(onStoreChange);
      return () => pendingListeners.delete(onStoreChange);
    },
    () => pendingSends,
    () => EMPTY_PENDING,
  );
  return threadId ? sends.get(threadId) : undefined;
}

/* ---- Subscriptions -------------------------------------------------- */

/* Stored messages for a thread, with the just-sent pending turn merged in
   until the database has it. While the query is loading, the cached
   transcript (lib/message-cache.ts) stands in — a revisited thread paints
   on the first frame — and a brand-new chat paints its pending turn.
   `undefined` only when there's truly nothing to show yet. */
export function useThreadMessages(
  threadId: string | undefined,
  enabled = true,
  /** Incognito transcripts pass false: an ephemeral chat must never be
   *  snapshotted into (or painted from) the localStorage cache. */
  cacheable = true,
  compaction?: CompactionSnapshot,
): ChatMessage[] | undefined {
  const raw = useQuery(
    api.messages.listForThread,
    threadId && enabled ? { threadId: threadId as Id<"threads"> } : "skip",
  ) as ChatMessage[] | undefined;
  const pending = usePendingSend(threadId);
  const cached = useCachedThreadMessages(cacheable ? threadId : undefined);

  /* Server caught up — drop the bridge (in an effect; render stays pure). */
  const echoed =
    raw !== undefined &&
    pending !== undefined &&
    raw.some((message) => message.id === pending.user.id) &&
    raw.some((message) => message.id === pending.assistant.id);
  useEffect(() => {
    if (echoed) clearPendingSend(pending.threadId);
  }, [echoed, pending?.threadId]);

  /* Write-through once the thread is settled — never mid-generation, so a
     half-streamed reply can't resurrect from the cache. */
  const decoratedRaw = useMemo(
    () => (raw ? decorateCompactionMarkers(raw, compaction) : raw),
    [raw, compaction],
  );
  useEffect(() => {
    if (
      !cacheable ||
      !threadId ||
      !decoratedRaw ||
      computeIsGenerating(decoratedRaw) ||
      /* A locked thread's rows are ciphertext and its transcript is opened
         in memory, so nothing would ever read this back — and a cache full
         of base64 is a cache that can only ever be painted by mistake. */
      decoratedRaw.some((message) => message.sealed)
    )
      return;
    writeThreadMessageCache(threadId, decoratedRaw);
  }, [cacheable, threadId, decoratedRaw]);

  const merged = useMemo(() => {
    if (decoratedRaw === undefined) {
      if (pending) return [pending.user, pending.assistant];
      if (cached) return decorateCompactionMarkers(cached, compaction);
      return undefined;
    }
    if (!pending) return decoratedRaw;
    const ids = new Set(decoratedRaw.map((message) => message.id));
    const next = [...decoratedRaw];
    if (!ids.has(pending.user.id)) next.push(pending.user);
    if (!ids.has(pending.assistant.id)) next.push(pending.assistant);
    return next;
  }, [decoratedRaw, pending, cached, compaction]);

  /* Carry unchanged rows across snapshots by reference (lib/message-identity)
     so the transcript's memoized rows can skip the history on every update.

     Reconciling needs the *previous* result, which is the one thing useMemo
     cannot hand itself — so the previous result is parked in a ref. The ref
     is written on commit and only read here, which means the baseline is
     always a transcript that actually reached the screen: a render React
     replays or throws away (StrictMode, Suspense, a cancelled transition)
     can no longer become the thing the next one is diffed against. The memo
     keeps the walk itself off every unrelated re-render.

     The read below is the one thing left that render does with a ref, and it
     is safe in the way the rule cares about: the worst a replayed render can
     do is diff against an older committed snapshot and reuse fewer
     references, which is slower, never wrong. Doing it in an effect instead
     would ship one unreconciled snapshot to the transcript on every stream
     tick — the whole thread re-rendering per token, which is the exact cost
     this function exists to avoid. */
  const committedRef = useRef<ChatMessage[] | undefined>(undefined);
  const stable = useMemo(
    () =>
      merged === undefined
        ? undefined
        : // eslint-disable-next-line react-hooks/refs -- see above.
          reconcileMessageIdentities(committedRef.current, merged),
    [merged],
  );
  useEffect(() => {
    committedRef.current = stable;
  }, [stable]);
  return stable;
}

export function computeIsGenerating(
  messages: ChatMessage[] | undefined,
): boolean {
  return Boolean(
    messages?.some(
      (message) => message.role === "assistant" && !isTerminal(message.status),
    ),
  );
}

/* ---- Actions -------------------------------------------------------- */

export type SendMessageArgs = {
  threadId?: string;
  text: string;
  /* Tier key or catalog slug — the send folds anything that isn't in the
     lineup to Auto (wireModel below), so a model that has since been
     removed quietly runs Auto. */
  model: string;
  attachments: AttachmentUpload[];
  search: boolean;
  thinking: ThinkingLevel;
  /* Ephemeral thread: flagged so listings, memory, search, and title
     generation all skip it, and it purges on exit. */
  incognito?: boolean;
};

/* Anything that isn't a model in the lineup folds to Auto. */
function wireModel(model: string): string {
  return CHAT_MODELS.find((entry) => entry.key === model)?.key ?? "Auto";
}

export function useMessageActions() {
  const sendUserMessage = useMutation(api.messages.sendUserMessage);
  const resetAssistantMessage = useMutation(api.messages.resetAssistantMessage);
  const prepareRetryFromUser = useMutation(
    api.messages.prepareAssistantRetryFromUser,
  );
  const branchThreadMutation = useMutation(api.threads.branchThread);

  /* `withOptimisticUpdate` builds a fresh mutation on every call, so these
     four have to be memoized or every action below (and every callback
     derived from them, all the way down to the memoized transcript rows)
     gets a new identity on every render. `useMutation` itself is already
     memoized on the client, so the base is a sound dependency. */
  const updateUserMessageBase = useMutation(api.messages.updateUserMessage);
  const updateUserMessage = useMemo(
    () =>
      updateUserMessageBase.withOptimisticUpdate((store, args) => {
        const threadId = args.threadId;
        const current = store.getQuery(api.messages.listForThread, {
          threadId,
        });
        if (!current) return;
        store.setQuery(
          api.messages.listForThread,
          { threadId },
          current.map((message: ChatMessage) =>
            message.id === args.messageId
              ? { ...message, content: args.content }
              : message,
          ) as typeof current,
        );
      }),
    [updateUserMessageBase],
  );

  const rollbackThreadBase = useMutation(api.threads.rollbackToMessage);
  const rollbackThreadMutation = useMemo(
    () =>
      rollbackThreadBase.withOptimisticUpdate((store, args) => {
        const threadId = args.threadId;
        const current = store.getQuery(api.messages.listForThread, {
          threadId,
        });
        if (!current) return;
        const checkpoint = current.findIndex(
          (message: ChatMessage) => message.id === args.messageId,
        );
        if (checkpoint === -1) return;
        store.setQuery(
          api.messages.listForThread,
          { threadId },
          current.slice(0, checkpoint + 1) as typeof current,
        );
      }),
    [rollbackThreadBase],
  );

  const updateAssistantMessageBase = useMutation(
    api.messages.updateAssistantMessage,
  );
  const updateAssistantMessage = useMemo(
    () =>
      updateAssistantMessageBase.withOptimisticUpdate((store, args) => {
        const threadId = args.threadId;
        const current = store.getQuery(api.messages.listForThread, {
          threadId,
        });
        if (!current) return;
        store.setQuery(
          api.messages.listForThread,
          { threadId },
          current.map((message: ChatMessage) =>
            message.id === args.messageId
              ? {
                  ...message,
                  ...(args.content !== undefined
                    ? { content: args.content }
                    : {}),
                  ...(args.status ? { status: args.status } : {}),
                }
              : message,
          ) as typeof current,
        );
      }),
    [updateAssistantMessageBase],
  );

  /* Send and bridge the new turn — the backend drives the stream. Returns
     the (possibly freshly created) thread id so callers can navigate to it. */
  const send = useCallback(
    async ({
      threadId,
      text,
      model,
      attachments,
      search,
      thinking,
      incognito,
    }: SendMessageArgs): Promise<string> => {
      const result = await sendUserMessage({
        threadId: threadId ? (threadId as Id<"threads">) : undefined,
        content: text,
        ...(incognito ? { incognito: true } : {}),
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
          search,
          model: wireModel(model),
        },
      });

      const now = Date.now();
      registerPendingSend({
        threadId: result.threadId,
        user: {
          id: result.userMessageId,
          role: "user",
          content: text,
          createdAt: now,
          attachments: attachments.map((file) => ({
            id: file.id,
            name: file.name,
            size: file.size,
            type: file.type,
          })),
        },
        assistant: {
          id: result.assistantId,
          role: "assistant",
          content: "",
          createdAt: now + 1,
          status: thinking !== "none" ? "thinking" : "streaming",
          streamId: result.streamId,
          model: wireModel(model),
          thinking: thinking !== "none",
          search,
        },
      });
      return result.threadId;
    },
    [sendUserMessage],
  );

  /* Wipe an errored/stopped reply and run it again on a fresh stream. */
  const retryAssistant = useCallback(
    async (threadId: string, messageId: string) => {
      await resetAssistantMessage({
        threadId: threadId as Id<"threads">,
        messageId: messageId as Id<"messages">,
      });
    },
    [resetAssistantMessage],
  );

  /* Rewrite a sent prompt in place, then regenerate the reply that
     follows it — an edit is a resend from that point in the timeline. */
  const editUserMessage = useCallback(
    async (threadId: string, messageId: string, content: string) => {
      await updateUserMessage({
        threadId: threadId as Id<"threads">,
        messageId: messageId as Id<"messages">,
        content,
      });
      await prepareRetryFromUser({
        threadId: threadId as Id<"threads">,
        userMessageId: messageId as Id<"messages">,
      });
    },
    [updateUserMessage, prepareRetryFromUser],
  );

  /* Copy the conversation up to a checkpoint into a fresh thread (the
     original stays put). Returns the new thread id for navigation. */
  const branchFromMessage = useCallback(
    async (threadId: string, messageId: string): Promise<string> => {
      const result = await branchThreadMutation({
        threadId: threadId as Id<"threads">,
        messageId: messageId as Id<"messages">,
      });
      return result.threadId;
    },
    [branchThreadMutation],
  );

  /* Delete everything after the checkpoint — messages, streams, and the
     artifacts those turns authored. Optimistically trimmed on screen. */
  const rollbackToMessage = useCallback(
    async (threadId: string, messageId: string) => {
      await rollbackThreadMutation({
        threadId: threadId as Id<"threads">,
        messageId: messageId as Id<"messages">,
      });
    },
    [rollbackThreadMutation],
  );

  /* Mark the in-flight reply stopped and abort our end of the stream —
     whatever text already landed stays. */
  const stopAssistant = useCallback(
    (threadId: string, messages: ChatMessage[]) => {
      const active = [...messages]
        .reverse()
        .find(
          (message) =>
            message.role === "assistant" && !isTerminal(message.status),
        );
      if (!active) return;
      const frozenText = active.streamId
        ? stopAssistantStream(active.streamId)
        : active.content;
      return updateAssistantMessage({
        threadId: threadId as Id<"threads">,
        messageId: active.id as Id<"messages">,
        content: frozenText,
        status: "stopped",
      });
    },
    [updateAssistantMessage],
  );

  return useMemo(
    () => ({
      send,
      retryAssistant,
      stopAssistant,
      editUserMessage,
      branchFromMessage,
      rollbackToMessage,
    }),
    [
      send,
      retryAssistant,
      stopAssistant,
      editUserMessage,
      branchFromMessage,
      rollbackToMessage,
    ],
  );
}
