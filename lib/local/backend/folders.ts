import { AppError, mutation, query } from "../functions";

const MAX_FOLDER_NAME_LENGTH = 80;
const MAX_FOLDERS = 50;

export const listForCurrentUser = query((ctx) =>
  ctx.db
    .all("folders")
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    .map((folder) => ({
      id: folder._id,
      name: folder.name,
      order: folder.order,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    })),
);

function cleanName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_FOLDER_NAME_LENGTH);
  if (!trimmed) throw new AppError("Folder name cannot be empty");
  return trimmed;
}

export const createFolder = mutation((ctx, { name }: { name: string }) => {
  const existing = ctx.db.all("folders");
  if (existing.length >= MAX_FOLDERS) throw new AppError("Folder limit reached");
  const now = Date.now();
  const order = existing.reduce((max, folder) => Math.max(max, folder.order), -1) + 1;
  return ctx.db.insert("folders", { name: cleanName(name), order, createdAt: now, updatedAt: now });
});

export const renameFolder = mutation((ctx, { folderId, name }: { folderId: string; name: string }) => {
  if (!ctx.db.get("folders", folderId)) throw new AppError("That folder doesn't exist anymore.");
  ctx.db.patch("folders", folderId, { name: cleanName(name), updatedAt: Date.now() });
  return null;
});

/** Deletes a folder. Its chats stay, back in the regular list. */
export const deleteFolder = mutation((ctx, { folderId }: { folderId: string }) => {
  for (const thread of ctx.db.all("threads")) {
    if (thread.folderId === folderId) ctx.db.patch("threads", thread._id, { folderId: undefined });
  }
  ctx.db.delete("folders", folderId);
  return null;
});
