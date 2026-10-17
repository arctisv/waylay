import type { LocalDatabase } from "./db";
import { AppError } from "./functions";
import type { MessageRow, ThreadRow } from "./schema";

/** A thread's messages, oldest first. */
export function threadMessages(db: LocalDatabase, threadId: string): MessageRow[] {
  return db
    .all("messages")
    .filter((message) => message.threadId === threadId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function requireThread(db: LocalDatabase, threadId: string): ThreadRow {
  const thread = db.get("threads", threadId);
  if (!thread) throw new AppError("That chat doesn't exist anymore.");
  return thread;
}
