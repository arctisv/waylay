import type { MessagePhase, MessageStatus } from "@/lib/messages";

/* Everything Waylay remembers, as plain records in the browser's IndexedDB.
   The shapes follow the server tables they stand in for, minus the columns
   that only mattered to a hosted service (owners, billing, share tokens). */

export type ThreadRow = {
  _id: string;
  title: string;
  titleStatus: "generating" | "ready";
  createdAt: number;
  updatedAt: number;
  pinnedAt?: number;
  /** Model key the last send picked. */
  model?: string;
  /** Ephemeral chat: hidden from history and wiped when left. */
  incognito?: boolean;
  folderId?: string;
  branchedFromThreadId?: string;
};

export type AttachmentRow = {
  id: string;
  name: string;
  size: number;
  type: string;
  /** The file's text, read in the browser. Model context only. */
  text?: string;
  skippedReason?: string;
};

export type MessageRow = {
  _id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  updatedAt: number;
  attachments?: AttachmentRow[];
  status?: MessageStatus;
  phases?: MessagePhase[];
  streamId?: string;
  model?: string;
  thinking?: boolean;
  search?: boolean;
  outputTokens?: number;
  durationMs?: number;
  addedMemoryIds?: string[];
};

export type FolderRow = {
  _id: string;
  name: string;
  order: number;
  createdAt: number;
  updatedAt: number;
};

export type SendOptions = {
  thinking?: boolean;
  search?: boolean;
  model?: string;
};

export type QueuedRow = {
  _id: string;
  threadId: string;
  content: string;
  attachments?: AttachmentRow[];
  options?: SendOptions;
  createdAt: number;
};

export type MemoryRow = {
  _id: string;
  memory: string;
  /** A permanent trait ("is left-handed") rather than something passing. */
  isStatic: boolean;
  createdAt: number;
  updatedAt: number;
  /** The chat the memory was learned in, when the model saved it. */
  threadId?: string;
};

/** Small singletons (preferences, favorites, gates) keyed by name. */
export type SettingRow = {
  _id: string;
  value: unknown;
};

export type Tables = {
  threads: ThreadRow;
  messages: MessageRow;
  folders: FolderRow;
  queued: QueuedRow;
  memories: MemoryRow;
  settings: SettingRow;
};

export type TableName = keyof Tables;

export const TABLE_NAMES: TableName[] = [
  "threads",
  "messages",
  "folders",
  "queued",
  "memories",
  "settings",
];
