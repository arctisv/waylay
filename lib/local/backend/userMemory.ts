import { action } from "../functions";
import { AppError } from "../functions";
import type { MemoryRow } from "../schema";

/* Long-term memory, kept on this device. The model saves memories with its
   remember tool; Settings → Memory lists, edits and forgets them. */

const MAX_MEMORY_LENGTH = 300;

export type MemoryEntry = {
  id: string;
  memory: string;
  isStatic: boolean;
  createdAt: number | null;
  updatedAt: number | null;
};

function toEntry(row: MemoryRow): MemoryEntry {
  return {
    id: row._id,
    memory: row.memory,
    isStatic: row.isStatic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function requireContent(content: string): string {
  const text = content.trim().slice(0, MAX_MEMORY_LENGTH);
  if (!text) throw new AppError("A memory can't be empty.");
  return text;
}

export const listMemories = action(async (ctx) => {
  const memories = ctx.db
    .all("memories")
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(toEntry);
  return { memories, totalItems: memories.length };
});

export const addMemory = action(async (ctx, { content, isStatic }: { content: string; isStatic?: boolean }) => {
  const now = Date.now();
  const id = ctx.db.insert("memories", {
    memory: requireContent(content),
    isStatic: isStatic ?? false,
    createdAt: now,
    updatedAt: now,
  });
  return toEntry(ctx.db.get("memories", id)!);
});

export const editMemory = action(async (ctx, { id, content }: { id: string; content: string }) => {
  if (!ctx.db.get("memories", id)) throw new AppError("That memory doesn't exist anymore.");
  ctx.db.patch("memories", id, { memory: requireContent(content), updatedAt: Date.now() });
  return toEntry(ctx.db.get("memories", id)!);
});

export const forgetMemory = action(async (ctx, { id }: { id: string }) => {
  ctx.db.delete("memories", id);
  return null;
});

export const forgetEverything = action(async (ctx) => {
  const memories = ctx.db.all("memories");
  for (const memory of memories) ctx.db.delete("memories", memory._id);
  return { memories: memories.length };
});
