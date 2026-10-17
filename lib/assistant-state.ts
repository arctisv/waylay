import type { MessagePhase } from "./messages";
import { isCompactPhase } from "./phase-activity";

/** Pick the furthest append-only stream snapshot. The live stream body stays
 * in the candidate set while the stored message row catches up, so switching
 * sources cannot briefly shrink a visible reply. */
export function furthestAssistantText(
  ...candidates: Array<string | undefined>
): string {
  return candidates.reduce<string>(
    (furthest, candidate) =>
      candidate !== undefined && candidate.length > furthest.length
        ? candidate
        : furthest,
    "",
  );
}

export function assistantActivityState({
  phases,
  terminal,
  canShowActivity,
  showText,
}: {
  phases: MessagePhase[];
  terminal: boolean;
  canShowActivity: boolean;
  showText: boolean;
}): {
  active: boolean;
  settled: boolean;
} {
  const compact = phases.filter(isCompactPhase);
  return {
    active: canShowActivity && (compact.length > 0 || !showText),
    settled: terminal || (showText && compact.length === 0),
  };
}
