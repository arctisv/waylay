import { action, mutation, query } from "../functions";
import { getSetting, setSetting } from "../settings";
import { pickFallbacks } from "@/lib/suggestions";

/* The two starter cards under the composer, drawn from the built-in pool of
   prompts. Dismissing a card swaps in the next one from the reserve; an
   empty reserve is refilled from the pool, skipping what was turned down. */

const VISIBLE_COUNT = 2;
const RESERVE_COUNT = 6;
const DISMISSED_LIMIT = 40;

type Stored = { prompt: string; icon: string };
type State = { visible: Stored[]; reserve: Stored[]; pendingSlot: number | null; dismissed: string[] };

const EMPTY: State = { visible: [], reserve: [], pendingSlot: null, dismissed: [] };

export const get = query((ctx) => {
  const state = getSetting<State>(ctx.db, "homeSuggestions") ?? EMPTY;
  return { visible: state.visible, reserve: state.reserve, pendingSlot: state.pendingSlot };
});

export const dismiss = mutation((ctx, { slot }: { slot: number }) => {
  const state = getSetting<State>(ctx.db, "homeSuggestions") ?? EMPTY;
  const index = Math.floor(slot);
  const current = state.visible[index];
  if (!current) return { needsBatch: state.visible.length < VISIBLE_COUNT };
  const dismissed = [...state.dismissed, current.prompt].slice(-DISMISSED_LIMIT);
  const [next, ...reserve] = state.reserve;
  setSetting(ctx.db, "homeSuggestions", {
    ...state,
    dismissed,
    reserve,
    visible: next ? state.visible.map((card, at) => (at === index ? next : card)) : state.visible,
    pendingSlot: next ? null : index,
  });
  return { needsBatch: !next };
});

/** Fills empty cards and the reserve from the built-in pool. */
export const replenish = action(async (ctx) => {
  const state = getSetting<State>(ctx.db, "homeSuggestions") ?? EMPTY;
  const showing = [...state.visible, ...state.reserve].map((card) => card.prompt);
  const fresh = pickFallbacks(VISIBLE_COUNT + RESERVE_COUNT, [...state.dismissed, ...showing]);
  const visible = [...state.visible];
  if (state.pendingSlot !== null && fresh.length > 0) visible[state.pendingSlot] = fresh.shift()!;
  while (visible.length < VISIBLE_COUNT && fresh.length > 0) visible.push(fresh.shift()!);
  setSetting(ctx.db, "homeSuggestions", {
    ...state,
    visible,
    reserve: [...state.reserve, ...fresh].slice(0, RESERVE_COUNT),
    pendingSlot: null,
  });
  return null;
});
