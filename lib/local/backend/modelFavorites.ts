import { mutation, query } from "../functions";
import { getSetting, setSetting } from "../settings";

export const get = query((ctx) => getSetting<string[]>(ctx.db, "modelFavorites") ?? null);

export const save = mutation((ctx, { keys }: { keys: string[] }) => {
  const cleaned = [...new Set(keys.map((key) => key.trim()).filter((key) => key && key.length <= 200))].slice(0, 100);
  setSetting(ctx.db, "modelFavorites", cleaned);
  return null;
});
