import { mutation, query } from "../functions";
import { memoryEnabled, setSetting } from "../settings";

export const getMemorySettings = query((ctx) => ({ enabled: memoryEnabled(ctx.db) }));

export const setMemoryEnabled = mutation((ctx, { enabled }: { enabled: boolean }) => {
  setSetting(ctx.db, "memory", { enabled });
  return null;
});
