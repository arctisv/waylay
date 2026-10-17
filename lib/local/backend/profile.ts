import { mutation, query } from "../functions";
import { getSetting, setSetting } from "../settings";

type Profile = { name: string | null };

export const get = query((ctx): Profile => getSetting<Profile>(ctx.db, "profile") ?? { name: null });

export const setName = mutation((ctx, { name }: { name: string }) => {
  const trimmed = name.trim().slice(0, 60);
  setSetting(ctx.db, "profile", trimmed ? { name: trimmed } : null);
  return null;
});
