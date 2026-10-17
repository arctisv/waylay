import type { MessagePhase, MessageStatus } from "./messages";

/* Everything an on-device turn narrates is a compact line of activity:
   getting the model ready, thinking, and the two tools it can call. */
const COMPACT_KINDS = new Set([
  /* Getting the on-device model ready: the download, then the load. */
  "model",
  "thought",
  "calc",
  "memory",
]);

/** Phases that belong inside the completed activity disclosure. */
export function isCompactPhase(phase: MessagePhase): boolean {
  return COMPACT_KINDS.has(phase.kind);
}

export function compactPhases(phases: MessagePhase[]): MessagePhase[] {
  return phases.filter(isCompactPhase);
}

/**
 * Whether two phase lists hold the same phases.
 *
 * Phase objects are carried across snapshots by reference
 * (lib/message-identity.ts), but the little arrays a render plan slices them
 * into are rebuilt every time the reply grows a character. Comparing element
 * by element is what lets the settled rows above a streaming tail memoize —
 * otherwise every disclosure in the turn re-renders on every typewriter
 * tick.
 */
export function samePhases(
  previous: readonly MessagePhase[],
  next: readonly MessagePhase[],
): boolean {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  for (let i = 0; i < previous.length; i += 1) {
    if (previous[i] !== next[i]) return false;
  }
  return true;
}

/** The latest phase is the thing the large pre-response indicator narrates.
 * A just-finished call remains current through the tiny gap before the next
 * one starts, avoiding a generic filler flash between chained tools. */
export function currentPhase(
  phases: MessagePhase[],
): MessagePhase | undefined {
  return [...phases].reverse().find(isCompactPhase);
}

export function phaseAction(
  phase: MessagePhase | undefined,
  _status: MessageStatus | undefined,
  thinking: boolean,
): string | null {
  if (!phase) return thinking ? "Thinking" : null;

  switch (phase.kind) {
    case "model":
      return phase.action?.trim() || "Getting the model ready";
    case "thought":
      return thinking ? "Thinking" : null;
    case "calc":
      return "Calculating";
    case "memory":
      return "Saving to memory";
    default:
      return null;
  }
}

export function completedLabel(phase: MessagePhase): string {
  switch (phase.kind) {
    case "model":
      return "Loaded the model";
    case "thought": {
      const seconds = phase.durationMs
        ? Math.max(1, Math.round(phase.durationMs / 1000))
        : null;
      return seconds
        ? `Thought for ${seconds} second${seconds === 1 ? "" : "s"}`
        : "Thought it over";
    }
    case "calc":
      return phase.error
        ? "Couldn't calculate"
        : phase.label
          ? `Calculated ${phase.label}`
          : "Calculated";
    case "memory":
      return "Saved to memory";
    default:
      return "Finished a task";
  }
}
