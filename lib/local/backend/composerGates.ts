import { mutation, query } from "../functions";
import { getSetting, setSetting } from "../settings";

type ThinkingLevel = "none" | "low" | "medium" | "high";
type Gates = { search: boolean; thinking: ThinkingLevel };

export const get = query((ctx) => getSetting<Gates>(ctx.db, "composerGates") ?? null);

export const save = mutation((ctx, gates: Gates) => {
  setSetting(ctx.db, "composerGates", { search: gates.search, thinking: gates.thinking });
  return null;
});
