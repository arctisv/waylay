import { AppError, mutation, query } from "../functions";
import {
  appendUserTurn,
  cancelTurn,
  drainQueue,
  generateThreadTitle,
  restartAssistantTurn,
} from "../inference/turns";
import { fallbackTitleFromPrompt, titlePromptInput } from "../inference/titles";
import type { AttachmentRow, MessageRow, SendOptions } from "../schema";
import { requireThread, threadMessages } from "../threads";
import type { MessagePhase, MessageStatus } from "./types";

/* One object URL per stored picture, made once and kept for the tab's life
   so a re-render never swaps the image out from under its <img>. */
const objectUrls = new Map<string, string>();

function urlFor(attachment: AttachmentRow): string | undefined {
  if (!attachment.data) return undefined;
  let url = objectUrls.get(attachment.id);
  if (!url) {
    url = URL.createObjectURL(attachment.data);
    objectUrls.set(attachment.id, url);
  }
  return url;
}

function formatMessage(message: MessageRow) {
  return {
    id: message._id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    /* The file text stays in the database for the model; the screens only
       need the chip, or the picture. */
    attachments: message.attachments?.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      size: attachment.size,
      type: attachment.type,
      url: urlFor(attachment),
    })),
    status: message.status,
    phases: message.phases,
    streamId: message.streamId,
    model: message.model,
    thinking: message.thinking,
    addedMemoryIds: message.addedMemoryIds,
    outputTokens: message.outputTokens,
    durationMs: message.durationMs,
  };
}

function requireMessage(threadId: string, message: MessageRow | undefined, role: MessageRow["role"]): MessageRow {
  if (!message || message.threadId !== threadId || message.role !== role) {
    throw new AppError("That message doesn't exist anymore.");
  }
  return message;
}

export const listForThread = query((ctx, { threadId }: { threadId: string }) =>
  threadMessages(ctx.db, threadId).map(formatMessage),
);

/** Live text of a reply while it's being written. */
export const getStreamBody = query((ctx, { streamId }: { streamId: string }) => {
  const body = ctx.db.stream(streamId);
  return body ?? { text: "", status: "done" as const };
});

export const sendUserMessage = mutation(
  (
    ctx,
    {
      threadId,
      content,
      attachments,
      options,
      incognito,
    }: {
      threadId?: string;
      content: string;
      attachments?: AttachmentRow[];
      options?: SendOptions;
      incognito?: boolean;
    },
  ) => {
    const now = Date.now();
    const model = options?.model ?? "Auto";
    let resolvedThreadId = threadId;

    if (!resolvedThreadId) {
      resolvedThreadId = incognito
        ? ctx.db.insert("threads", {
            title: "Incognito chat",
            titleStatus: "ready",
            createdAt: now,
            updatedAt: now,
            model,
            incognito: true,
          })
        : ctx.db.insert("threads", {
            title: fallbackTitleFromPrompt(titlePromptInput(content)),
            /* A picture chat keeps its prompt as the title: naming it would
               mean swapping the picture model out for a text one. */
            titleStatus: model === "Image" ? "ready" : "generating",
            createdAt: now,
            updatedAt: now,
            model,
          });
    } else {
      requireThread(ctx.db, resolvedThreadId);
      ctx.db.patch("threads", resolvedThreadId, { updatedAt: now, model });
    }

    const turn = appendUserTurn({
      threadId: resolvedThreadId,
      content,
      attachments,
      options: { ...options, model },
      now,
    });
    return { threadId: resolvedThreadId, ...turn };
  },
);

export const updateUserMessage = mutation(
  (ctx, { threadId, messageId, content }: { threadId: string; messageId: string; content: string }) => {
    const thread = requireThread(ctx.db, threadId);
    requireMessage(threadId, ctx.db.get("messages", messageId), "user");
    const now = Date.now();
    ctx.db.patch("messages", messageId, { content, updatedAt: now });

    const firstUser = threadMessages(ctx.db, threadId).find((message) => message.role === "user");
    if (firstUser?._id === messageId && !thread.incognito) {
      ctx.db.patch("threads", threadId, {
        title: fallbackTitleFromPrompt(titlePromptInput(content)),
        titleStatus: "generating",
        updatedAt: now,
      });
      void generateThreadTitle(threadId, { fromTranscript: false });
    }
    return null;
  },
);

/** After an edit: rewrite the reply that follows the edited message. */
export const prepareAssistantRetryFromUser = mutation(
  (ctx, { threadId, userMessageId }: { threadId: string; userMessageId: string }) => {
    requireThread(ctx.db, threadId);
    const user = requireMessage(threadId, ctx.db.get("messages", userMessageId), "user");
    const messages = threadMessages(ctx.db, threadId);
    const index = messages.findIndex((message) => message._id === user._id);
    const existing = messages.slice(index + 1).find((message) => message.role === "assistant");

    if (existing) return restartAssistantTurn(threadId, existing);

    const now = Date.now();
    const assistantId = ctx.db.insert("messages", {
      threadId,
      role: "assistant",
      content: "",
      createdAt: user.createdAt + 1,
      updatedAt: now,
      status: "streaming",
      phases: [],
      model: ctx.db.get("threads", threadId)?.model ?? "Auto",
      thinking: false,
    });
    return restartAssistantTurn(threadId, ctx.db.get("messages", assistantId)!);
  },
);

/** Retry: clear a reply and write it again. */
export const resetAssistantMessage = mutation(
  (ctx, { threadId, messageId }: { threadId: string; messageId: string }) => {
    requireThread(ctx.db, threadId);
    const message = requireMessage(threadId, ctx.db.get("messages", messageId), "assistant");
    return restartAssistantTurn(threadId, message);
  },
);

/** Used by Stop: freezes the reply at the text on screen. */
export const updateAssistantMessage = mutation(
  (
    ctx,
    {
      threadId,
      messageId,
      content,
      status,
      phases,
    }: {
      threadId: string;
      messageId: string;
      content?: string;
      status?: MessageStatus;
      phases?: MessagePhase[];
    },
  ) => {
    const message = requireMessage(threadId, ctx.db.get("messages", messageId), "assistant");
    const now = Date.now();
    if (status === "stopped" || status === "error") cancelTurn(messageId);
    ctx.db.patch("messages", messageId, {
      ...(content !== undefined ? { content } : {}),
      ...(status !== undefined ? { status } : {}),
      phases: phases ?? (message.phases ?? []).filter((phase) => !phase.pending),
      updatedAt: now,
    });
    ctx.db.patch("threads", threadId, { updatedAt: now });
    if (status === "complete" || status === "stopped" || status === "error") drainQueue(threadId);
    return null;
  },
);

