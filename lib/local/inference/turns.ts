"use client";

import type { MessagePhase } from "@/lib/messages";
import { MAX_MEMORY_LENGTH } from "../backend/userMemory";
import { createId, db } from "../db";
import { getDeviceSupport } from "../device/support";
import type { SupportReport } from "../device/types";
import type { AttachmentRow, MessageRow, SendOptions } from "../schema";
import { getSetting, memoryEnabled } from "../settings";
import { threadMessages } from "../threads";
import {
  interruptGeneration,
  isRuntimeLoaded,
  loadRuntime,
  type ChatEngine,
  type EngineMessage,
  type LoadProgress,
  unloadEngine,
} from "./engine";
import {
  IMAGE_MODEL,
  isImageModelLoaded,
  loadImageModel,
  paintImage,
} from "./image-engine";
import { localModelFor, runtimeFor, type Runtime } from "./models";
import {
  buildSystemPrompt,
  THREAD_TITLE_FROM_TRANSCRIPT_PROMPT,
  THREAD_TITLE_PROMPT,
} from "./prompt";
import { explicitMemory } from "./explicit-memory";
import { sanitizeTitle, titlePromptInput } from "./titles";
import { mightBeToolCall, parseToolCall, runTool, type ToolCall } from "./tools";

/* Replies, written on this device. Every send queues a turn; turns run one
   at a time because there is one model engine. A turn loads the model
   (narrating the download as an activity line), streams the answer into the
   message's live stream buffer, runs at most one tool call, and settles the
   message. Stop marks the turn cancelled and interrupts the engine; the
   text already on screen is what stays. */

/** The model's context window, in tokens. */
const CONTEXT_TOKENS = 4096;
/** Room left for the reply itself. */
const REPLY_TOKENS = 1024;
/** Phase updates (download progress, thinking text) are written at most this often. */
const PHASE_WRITE_MS = 250;

const LIVE_STATUSES = new Set(["thinking", "streaming"]);

export function isMessageLive(message: MessageRow): boolean {
  return (
    message.role === "assistant" &&
    message.status !== undefined &&
    LIVE_STATUSES.has(message.status)
  );
}

type Turn = { threadId: string; messageId: string; cancelled: boolean };

const turns = new Map<string, Turn>();
let activeTurn: Turn | null = null;
let chain: Promise<void> = Promise.resolve();
const pendingTitles = new Set<string>();

/** Everything that needs the engine runs through here, one job at a time. */
function enqueue(job: () => Promise<void>) {
  chain = chain.then(job).catch((error) => {
    console.error("Waylay:", error);
  });
}

/* ---- Starting and stopping ------------------------------------------- */

export function startAssistantTurn(threadId: string, messageId: string): void {
  const turn: Turn = { threadId, messageId, cancelled: false };
  turns.set(messageId, turn);
  enqueue(() => runTurn(turn));
}

/** Stops one reply, whether it's running or still waiting its turn. */
export function cancelTurn(messageId: string): void {
  const turn = turns.get(messageId);
  if (!turn) return;
  turn.cancelled = true;
  if (activeTurn === turn) void interruptGeneration();
}

export function cancelTurnsForThread(threadId: string): void {
  for (const turn of turns.values()) {
    if (turn.threadId === threadId) cancelTurn(turn.messageId);
  }
}

/** Writes a user message and an empty reply, and starts the reply. */
export function appendUserTurn({
  threadId,
  content,
  attachments,
  options,
  now,
}: {
  threadId: string;
  content: string;
  attachments?: AttachmentRow[];
  options?: SendOptions;
  now: number;
}) {
  const streamId = createId();
  /* Only a reasoning model can think; any other turn just answers. */
  const thinking = Boolean(options?.thinking) && localModelFor(options?.model).reasoning;
  const userMessageId = db.insert("messages", {
    threadId,
    role: "user",
    content,
    createdAt: now,
    updatedAt: now,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  });
  const assistantId = db.insert("messages", {
    threadId,
    role: "assistant",
    content: "",
    createdAt: now + 1,
    updatedAt: now + 1,
    status: thinking ? "thinking" : "streaming",
    phases: [],
    streamId,
    model: options?.model ?? "Auto",
    thinking,
  });
  db.setStream(streamId, { text: "", status: "pending" });
  startAssistantTurn(threadId, assistantId);
  return { userMessageId, assistantId, streamId };
}

/** Clears a reply and writes it again on a fresh stream. */
export function restartAssistantTurn(threadId: string, message: MessageRow) {
  cancelTurn(message._id);
  const streamId = createId();
  db.patch("messages", message._id, {
    content: "",
    status: message.thinking ? "thinking" : "streaming",
    phases: [],
    streamId,
    outputTokens: undefined,
    durationMs: undefined,
    addedMemoryIds: undefined,
    attachments: undefined,
    updatedAt: Date.now(),
  });
  db.patch("threads", threadId, { updatedAt: Date.now() });
  db.setStream(streamId, { text: "", status: "pending" });
  startAssistantTurn(threadId, message._id);
  return { assistantId: message._id, streamId };
}

/* ---- The turn ---------------------------------------------------------- */

async function runTurn(turn: Turn): Promise<void> {
  const message = db.get("messages", turn.messageId);
  if (turn.cancelled || !message || !isMessageLive(message) || !message.streamId) {
    if (turns.get(turn.messageId) === turn) turns.delete(turn.messageId);
    return;
  }

  activeTurn = turn;
  const streamId = message.streamId;
  const startedAt = Date.now();
  const phases: MessagePhase[] = [];
  const addedMemoryIds: string[] = [];
  let outputTokens = 0;

  try {
    const support = await getDeviceSupport();
    if (support.status !== "ready") throw new UnsupportedDeviceError();
    /* Auto picks for you: a request for a picture goes to the Image model
       wherever it can run. */
    if (message.model === "Auto" && support.backend === "webgpu" && asksForPicture(turnPrompt(turn, message))) {
      db.patch("messages", message._id, { model: "Image" });
      message.model = "Image";
    }
    if (message.model === "Image") {
      await runPaintTurn(turn, message, support, startedAt);
      return;
    }
    const runtime = runtimeFor(message.model, support);
    const engine = await prepareModel(message, runtime);
    if (turn.cancelled) return;

    /* An outright "remember that…" is kept straight away, so it never
       depends on a small model choosing to call its tool. */
    const asked = explicitMemory(turnPrompt(turn, message));
    const rememberedId = asked ? saveMemory(asked, turn.threadId) : null;
    if (asked && rememberedId) {
      addedMemoryIds.push(rememberedId);
      phases.push({ kind: "memory", label: asked });
      writePhases(message._id, phases);
    }

    const conversation = buildConversation(turn.threadId, message, runtime);
    if (asked && rememberedId) {
      conversation[0] = {
        role: "system",
        content: `${conversation[0].content}\n\nYou just saved this to memory about them: "${asked}" Confirm it in a few words, speaking to them as "you".`,
      };
    }
    let result = await generate({ engine, turn, message, runtime, conversation, phases, tools: true });
    outputTokens += result.completionTokens ?? 0;

    if (!turn.cancelled && result.toolCall) {
      const outcome = runTool(result.toolCall, {
        remember: (fact) => saveMemory(fact, turn.threadId),
      });
      if (outcome) {
        if (outcome.phase) phases.push({ ...outcome.phase, pending: false } as MessagePhase);
        if (outcome.memoryId) addedMemoryIds.push(outcome.memoryId);
        writePhases(message._id, phases);
        conversation.push(
          { role: "assistant", content: result.raw },
          {
            role: "user",
            content: `${outcome.feedback}\n\nNow reply to my previous message using this. Don't mention tools or functions.`,
          },
        );
      }
      if (!turn.cancelled) {
        result = await generate({ engine, turn, message, runtime, conversation, phases, tools: false });
        outputTokens += result.completionTokens ?? 0;
      }
    }
    if (turn.cancelled) return;

    const now = Date.now();
    db.patch("messages", message._id, {
      content: result.answer,
      status: "complete",
      phases: [...phases],
      outputTokens: outputTokens || undefined,
      durationMs: now - startedAt,
      addedMemoryIds: addedMemoryIds.length > 0 ? addedMemoryIds : undefined,
      updatedAt: now,
    });
    db.patch("threads", turn.threadId, { updatedAt: now });
  } catch (error) {
    if (!turn.cancelled) {
      db.patch("messages", message._id, {
        status: "error",
        content: describeError(error),
        phases: phases.filter((phase) => !phase.pending),
        updatedAt: Date.now(),
      });
    }
  } finally {
    db.setStream(streamId, null);
    if (activeTurn === turn) activeTurn = null;
    /* A retry registers a fresh turn under the same message id; only
       forget this one if it's still the one on record. */
    if (turns.get(turn.messageId) === turn) turns.delete(turn.messageId);
    afterTurn(turn.threadId);
  }
}

/** Loads the turn's model, narrating the download on the message. */
async function prepareModel(message: MessageRow, runtime: Runtime): Promise<ChatEngine> {
  if (isRuntimeLoaded(runtime)) return loadRuntime(runtime);

  const phase = (progress: LoadProgress | null): MessagePhase => ({
    kind: "model",
    pending: true,
    action: loadingLabel(runtime, progress),
  });
  writePhases(message._id, [phase(null)]);
  let lastWrite = 0;
  const engine = await loadRuntime(runtime, (progress) => {
    const now = Date.now();
    if (now - lastWrite < PHASE_WRITE_MS && progress.value < 1) return;
    lastWrite = now;
    writePhases(message._id, [phase(progress)]);
  });
  writePhases(message._id, []);
  return engine;
}

function loadingLabel(
  model: { label: string; downloadMB: number },
  progress: LoadProgress | null,
): string {
  if (!progress) return `Getting ${model.label} ready`;
  const percent = Math.round(progress.value * 100);
  if (progress.cached) return `Loading ${model.label} · ${percent}%`;
  return `Downloading ${model.label} · ${percent}% of ${formatSize(model.downloadMB)}`;
}

/* ---- Pictures ------------------------------------------------------------ */

/** A turn on the Image model: paints the person's message as a picture and
 *  keeps it on the reply. */
async function runPaintTurn(
  turn: Turn,
  message: MessageRow,
  support: SupportReport,
  startedAt: number,
): Promise<void> {
  if (support.backend !== "webgpu") throw new PaintingNeedsGpuError();
  const prompt = turnPrompt(turn, message);
  if (!prompt) throw new Error("There's nothing to paint.");

  /* One big model in memory at a time: the text model steps aside. */
  await unloadEngine();
  if (!isImageModelLoaded()) {
    let lastWrite = 0;
    const phase = (progress: LoadProgress | null): MessagePhase => ({
      kind: "model",
      pending: true,
      action: loadingLabel(IMAGE_MODEL, progress),
    });
    writePhases(message._id, [phase(null)]);
    await loadImageModel(Boolean(support.specs.shaderF16), (progress) => {
      const now = Date.now();
      if (now - lastWrite < PHASE_WRITE_MS && progress.value < 1) return;
      lastWrite = now;
      writePhases(message._id, [phase(progress)]);
    });
  }
  if (turn.cancelled) return;

  const painting = (value: number): MessagePhase => ({
    kind: "image",
    pending: true,
    action: `Painting · ${Math.round(value * 100)}%`,
  });
  writePhases(message._id, [painting(0)]);
  let lastWrite = 0;
  const blob = await paintImage(prompt, (value) => {
    const now = Date.now();
    if (now - lastWrite < PHASE_WRITE_MS) return;
    lastWrite = now;
    if (!turn.cancelled) writePhases(message._id, [painting(value)]);
  });
  if (turn.cancelled) return;

  const now = Date.now();
  db.patch("messages", message._id, {
    content: "",
    status: "complete",
    phases: [],
    attachments: [
      {
        id: createId(),
        name: `${fileNameFor(prompt)}.png`,
        size: blob.size,
        type: blob.type || "image/png",
        data: blob,
      },
    ],
    durationMs: now - startedAt,
    updatedAt: now,
  });
  db.patch("threads", turn.threadId, { updatedAt: now });
}

/** The person's message this reply answers. */
function turnPrompt(turn: Turn, message: MessageRow): string {
  return (
    threadMessages(db, turn.threadId)
      .filter((row) => row.role === "user" && row.createdAt < message.createdAt)
      .at(-1)
      ?.content.trim() ?? ""
  );
}

/* "Draw a fox", "paint me a lighthouse", "generate an image of…" — asked
   outright, at the start of the message. */
const PICTURE_REQUEST =
  /^(please\s+)?((can|could|would) you\s+)?(draw|paint|sketch|illustrate)\b|^(please\s+)?((can|could|would) you\s+)?(generate|create|make|render)\s+(me\s+)?(an?\s+)?(image|picture|drawing|painting|illustration|photo)\b/i;

function asksForPicture(prompt: string): boolean {
  return PICTURE_REQUEST.test(prompt.trim());
}

/** "A fox in the snow, watercolor" → "a-fox-in-the-snow-watercolor". */
function fileNameFor(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return slug || "waylay-picture";
}

function formatSize(megabytes: number): string {
  return megabytes >= 1000 ? `${(megabytes / 1000).toFixed(1)} GB` : `${megabytes} MB`;
}

function writePhases(messageId: string, phases: MessagePhase[]) {
  db.patch("messages", messageId, { phases: [...phases] });
}

/* ---- Prompting --------------------------------------------------------- */

const estimateTokens = (text: string) => Math.ceil(text.length / 3.5);

function userContent(message: MessageRow): string {
  const files = (message.attachments ?? [])
    .filter((file) => file.text)
    .map((file) => `[Attached file: ${file.name}]\n\`\`\`\n${file.text}\n\`\`\``);
  return [message.content, ...files].filter(Boolean).join("\n\n");
}

/** The system prompt plus as much recent conversation as fits the context window. */
function buildConversation(
  threadId: string,
  reply: MessageRow,
  runtime: Runtime,
): EngineMessage[] {
  const memories = memoryEnabled(db)
    ? db
        .all("memories")
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 40)
        .map((memory) => memory.memory)
    : [];
  const system = buildSystemPrompt({
    family: runtime.family,
    preferences: getSetting<{ text: string }>(db, "preferences")?.text ?? null,
    memories,
    memoryEnabled: memoryEnabled(db),
    name: getSetting<{ name: string }>(db, "profile")?.name ?? null,
    units: getSetting<"auto" | "metric" | "imperial">(db, "units") ?? "auto",
    now: new Date(),
  });

  const earlier = threadMessages(db, threadId).filter(
    (message) =>
      message.createdAt < reply.createdAt &&
      (message.role === "user" ||
        ((message.status === "complete" || message.status === "stopped") && message.content.trim())),
  );

  let budget = CONTEXT_TOKENS - REPLY_TOKENS - estimateTokens(system);
  const kept: EngineMessage[] = [];
  for (let index = earlier.length - 1; index >= 0; index -= 1) {
    const message = earlier[index];
    const role = message.role;
    let content = role === "user" ? userContent(message) : message.content;
    const cost = estimateTokens(content);
    if (cost > budget) {
      if (kept.length > 0) break;
      // The newest message alone is too long: send as much of it as fits.
      content = content.slice(0, Math.floor(budget * 3.5));
    }
    budget -= Math.min(cost, budget);
    kept.unshift(role === "user" ? { role: "user", content } : { role: "assistant", content });
    if (budget <= 0) break;
  }
  // The conversation has to open with the person, not the assistant.
  while (kept.length > 0 && kept[0].role !== "user") kept.shift();
  return [{ role: "system", content: system }, ...kept];
}

/* ---- Generating -------------------------------------------------------- */

type Generation = {
  raw: string;
  answer: string;
  toolCall: ToolCall | null;
  completionTokens?: number;
};

/** Splits a reply into its <think> reasoning and the answer after it. */
function splitThinking(raw: string): { thought: string | null; done: boolean; answer: string } {
  const trimmed = raw.trimStart();
  if ("<think>".startsWith(trimmed) && trimmed !== "") return { thought: "", done: false, answer: "" };
  if (!trimmed.startsWith("<think>")) return { thought: null, done: true, answer: raw };
  const body = trimmed.slice("<think>".length);
  const end = body.indexOf("</think>");
  if (end === -1) return { thought: body.trim(), done: false, answer: "" };
  return {
    thought: body.slice(0, end).trim(),
    done: true,
    answer: body.slice(end + "</think>".length).replace(/^\s+/, ""),
  };
}

async function generate({
  engine,
  turn,
  message,
  runtime,
  conversation,
  phases,
  tools,
}: {
  engine: ChatEngine;
  turn: Turn;
  message: MessageRow;
  runtime: Runtime;
  conversation: EngineMessage[];
  phases: MessagePhase[];
  tools: boolean;
}): Promise<Generation> {
  const streamId = message.streamId!;
  const reasoning = runtime.reasoning && Boolean(message.thinking);
  let thought: MessagePhase | null = null;
  let thoughtStartedAt = 0;
  let streaming = false;
  let lastPhaseWrite = 0;

  const onText = (raw: string) => {
    if (turn.cancelled) return;
    const split = splitThinking(raw);
    if (split.thought !== null && reasoning) {
      if (!thought) {
        thoughtStartedAt = Date.now();
        thought = { kind: "thought", pending: true, text: "" };
        phases.push(thought);
      }
      const updated: MessagePhase = {
        ...thought,
        text: split.thought,
        pending: !split.done,
        ...(split.done ? { durationMs: Date.now() - thoughtStartedAt } : {}),
      };
      phases[phases.indexOf(thought)] = updated;
      thought = updated;
      const now = Date.now();
      if (split.done || now - lastPhaseWrite >= PHASE_WRITE_MS) {
        lastPhaseWrite = now;
        writePhases(message._id, phases);
      }
    }

    const holding = tools && mightBeToolCall(split.answer);
    const visible = holding ? "" : split.answer;
    if (visible && !streaming) {
      streaming = true;
      db.patch("messages", message._id, { status: "streaming" });
    }
    db.setStream(streamId, { text: visible, status: "streaming" });
  };

  const result = await engine.generate({
    messages: conversation,
    maxTokens: REPLY_TOKENS,
    temperature: 0.6,
    topP: 0.9,
    ...(runtime.reasoning ? { enableThinking: reasoning } : {}),
    onText,
  });

  const { answer } = splitThinking(result.text);
  const toolCall = tools ? parseToolCall(answer) : null;
  if (!toolCall && !turn.cancelled) db.setStream(streamId, { text: answer, status: "streaming" });
  return {
    raw: result.text,
    answer: toolCall ? "" : answer.trimEnd(),
    toolCall,
    completionTokens: result.completionTokens,
  };
}

/* ---- Memory -------------------------------------------------------------- */

function saveMemory(fact: string, threadId: string): string | null {
  if (!memoryEnabled(db)) return null;
  const text = fact.trim().slice(0, MAX_MEMORY_LENGTH);
  const existing = db.all("memories").find((memory) => memory.memory.toLowerCase() === text.toLowerCase());
  if (existing) return existing._id;
  const now = Date.now();
  return db.insert("memories", { memory: text, isStatic: false, createdAt: now, updatedAt: now, threadId });
}

/* ---- After a turn ------------------------------------------------------ */

function afterTurn(threadId: string) {
  const thread = db.get("threads", threadId);
  if (thread?.titleStatus === "generating" && !thread.incognito) {
    void generateThreadTitle(threadId, { fromTranscript: false });
  }
  drainQueue(threadId);
}

/** Sends the next message typed while this thread's reply was being written. */
export function drainQueue(threadId: string): void {
  if (threadMessages(db, threadId).some(isMessageLive)) return;
  const next = db
    .all("queued")
    .filter((queued) => queued.threadId === threadId)
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  if (!next) return;
  db.delete("queued", next._id);
  const now = Date.now();
  db.patch("threads", threadId, { updatedAt: now, model: next.options?.model });
  appendUserTurn({
    threadId,
    content: next.content,
    attachments: next.attachments,
    options: next.options,
    now,
  });
}

/** Names a chat with the model, after whatever it's writing now. */
export function generateThreadTitle(
  threadId: string,
  { fromTranscript }: { fromTranscript: boolean },
): Promise<void> {
  if (pendingTitles.has(threadId)) return Promise.resolve();
  pendingTitles.add(threadId);
  return new Promise((resolve) => {
    enqueue(async () => {
      try {
        await writeTitle(threadId, fromTranscript);
      } finally {
        pendingTitles.delete(threadId);
        if (db.get("threads", threadId)?.titleStatus === "generating") {
          db.patch("threads", threadId, { titleStatus: "ready" });
        }
        resolve();
      }
    });
  });
}

async function writeTitle(threadId: string, fromTranscript: boolean) {
  const thread = db.get("threads", threadId);
  if (!thread) return;
  const messages = threadMessages(db, threadId);
  const prompt = fromTranscript
    ? messages
        .filter((message) => message.content.trim() && message.status !== "error")
        .map((message) => `${message.role === "user" ? "Them" : "You"}: ${message.content.trim()}`)
        .join("\n")
        .slice(-3000)
    : titlePromptInput(messages.find((message) => message.role === "user")?.content ?? "");
  if (!prompt.trim()) return;

  const support = await getDeviceSupport();
  if (support.status !== "ready") return;
  const runtime = runtimeFor(thread.model ?? undefined, support);
  const engine = await loadRuntime(runtime);
  const reply = await engine.generate({
    messages: [
      { role: "system", content: fromTranscript ? THREAD_TITLE_FROM_TRANSCRIPT_PROMPT : THREAD_TITLE_PROMPT },
      { role: "user", content: prompt },
    ],
    maxTokens: 20,
    temperature: 0.2,
    ...(runtime.reasoning ? { enableThinking: false } : {}),
  });
  const title = sanitizeTitle(splitThinking(reply.text).answer);
  if (title && db.get("threads", threadId)) {
    db.patch("threads", threadId, { title, titleStatus: "ready" });
  }
}

/* ---- Errors and recovery ----------------------------------------------- */

class UnsupportedDeviceError extends Error {
  constructor() {
    super("This device can't run the model.");
    this.name = "UnsupportedDeviceError";
  }
}

class PaintingNeedsGpuError extends Error {
  constructor() {
    super("Painting needs WebGPU.");
    this.name = "PaintingNeedsGpuError";
  }
}

function describeError(error: unknown): string {
  if (error instanceof UnsupportedDeviceError) {
    return "This browser or device can't run the model. Try the latest Chrome, Edge or Safari on a laptop or desktop.";
  }
  if (error instanceof PaintingNeedsGpuError) {
    return "Painting pictures needs your graphics chip, and this browser can't reach it. Open Waylay in the latest Chrome, Edge or Safari to paint.";
  }
  const text = error instanceof Error ? error.message : String(error);
  if (/fetch|network|load failed|connection/i.test(text)) {
    return "Couldn't download the model. Check your connection and try again.";
  }
  if (/memory|allocat|device.?lost|out of range|quota/i.test(text)) {
    return "This device ran out of memory running the model. Close some tabs, or pick a lighter model.";
  }
  return "Something went wrong running the model. Try again?";
}

/* A reply that was mid-flight when the tab closed can't be resumed: it
   settles as stopped, with whatever text it had. */
function recoverInterruptedTurns() {
  for (const message of db.all("messages")) {
    if (isMessageLive(message) && !turns.has(message._id)) {
      db.patch("messages", message._id, {
        status: message.content ? "stopped" : "error",
        ...(message.content ? {} : { content: "This reply was interrupted. Try again?" }),
        phases: (message.phases ?? []).filter((phase) => !phase.pending),
      });
    }
  }
  for (const thread of db.all("threads")) {
    if (thread.titleStatus === "generating" && !pendingTitles.has(thread._id)) {
      db.patch("threads", thread._id, { titleStatus: "ready" });
    }
  }
}

if (typeof window !== "undefined") {
  void db.load().then(recoverInterruptedTurns);
}
