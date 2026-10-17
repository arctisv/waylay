"use client";

import { memo, useEffect, useState } from "react";
import {
  IconBookmark,
  IconBrain,
  IconCalculator,
  IconChevronDown,
  IconChevronRight,
  IconStack2,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";

import type {
  MessagePhase,
  MessageStatus,
} from "@/lib/messages";
import { EASE_OUT, SHED_BLUR } from "@/lib/motion";
import {
  compactPhases,
  completedLabel,
  currentPhase,
  phaseAction,
  samePhases,
} from "@/lib/phase-activity";
import { claimScrollIntent } from "@/lib/scroll-intent";
import {
  phaseNarrationTarget,
  useSteadyPhaseNarration,
} from "@/lib/use-phase-narration";
import {
  PhaseIcon,
  PhaseLabel,
  MarkActivityIcon,
} from "./phase-motion";
import {
  PhaseDetailContent,
  PhaseRow,
  phaseDisclosure,
} from "./phase-row";

function ActivityGlyph({
  kind,
  size,
}: {
  kind: string | undefined;
  size: number;
}) {
  switch (kind) {
    case "thought":
      return <IconBrain size={size} stroke={2} />;
    case "calc":
      return <IconCalculator size={size} stroke={2} />;
    case "memory":
      return <IconBookmark size={size} stroke={2} />;
    default:
      return null;
  }
}

/* Getting the model ready has no glyph of its own: it wears the spinning
   mark, like any other wait. */
const GLYPH_KINDS = new Set(["thought", "calc", "memory"]);

/** The assistant turn's one activity surface. Before prose arrives it stays
 * mounted as the large current-phase indicator. Once the reply becomes
 * visible, one action settles in place; only multi-step work collapses into
 * the "Did N things" disclosure. */
export const PhaseActivity = memo(function PhaseActivity({
  phases,
  status,
  thinking,
  active,
  settled,
  animate,
}: {
  phases: MessagePhase[];
  status: MessageStatus | undefined;
  thinking: boolean;
  /** The response has not started and no richer card owns the progress UI. */
  active: boolean;
  /** Visible prose (or a terminal turn) has arrived. */
  settled: boolean;
  /** This mount caught a live turn, so its first appearance may ease in. */
  animate: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const compact = compactPhases(phases);
  const latest = currentPhase(phases);
  const narration = useSteadyPhaseNarration(
    phaseNarrationTarget({
      phase: latest,
      status,
      thinking,
      active,
      settled,
      phaseCount: compact.length,
    }),
    animate,
  );
  const final = narration.mode === "final";
  /* The assistant message renders the live indicator through one
     persistent element that hands off between compact runs — a stack left
     expanded by the previous run must not pre-open the next one. */
  useEffect(() => {
    if (!final) setExpanded(false);
  }, [final]);
  const single = final && compact.length === 1 ? compact[0] : undefined;
  const grouped = final && compact.length > 1;
  const current = narration.mode === "live" ? narration.phase : single;
  const singleExpandable = single
    ? phaseDisclosure(single).expandable
    : false;
  const expandable = grouped || singleExpandable;
  const narratedStatus =
    narration.mode === "live" ? narration.status : status;
  const narratedThinking =
    narration.mode === "live" ? narration.thinking : thinking;
  const actionLabel = phaseAction(current, narratedStatus, narratedThinking);
  const label = grouped
    ? `Did ${compact.length} thing${compact.length === 1 ? "" : "s"}`
    : single
      ? completedLabel(single)
      : actionLabel;
  const activityKind = single?.kind ?? current?.kind;
  const glyphSize = final ? 15 : 17;
  const spinner = !final && !GLYPH_KINDS.has(activityKind ?? "");
  const visible = narration.mode !== "hidden";

  const iconKey = grouped
    ? "complete"
    : spinner
      ? "spinner"
      : `phase-${current?.kind ?? narratedStatus ?? "waiting"}`;

  return (
    <>
      {/* The no-tools handoff is atomic: when prose arrives this row unmounts
          immediately, so it cannot hold space above or overlap the first line.
          Actual completed phases stay mounted and morph into their summary. */}
      {visible && (
        <motion.div
          key="phase-activity"
          initial={
            animate ? { opacity: 0, y: -4, filter: "blur(4px)" } : false
          }
          animate={{
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            transitionEnd: SHED_BLUR,
          }}
          exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
          transition={{
            opacity: { duration: 0.22, ease: EASE_OUT },
            filter: { duration: 0.24, ease: EASE_OUT },
            y: { type: "spring", stiffness: 460, damping: 34 },
          }}
          className="mb-2 flex w-full min-w-0 flex-col items-start"
        >
          <button
            type="button"
            disabled={!expandable}
            onClick={(event) => {
              claimScrollIntent(event.currentTarget);
              setExpanded((currentValue) => !currentValue);
            }}
            aria-expanded={expandable ? expanded : undefined}
            className={`-mx-1 flex max-w-full items-center px-1 py-0.5 text-left ${
              final ? "gap-1.5" : "gap-2"
            } ${
              expandable
                ? "cursor-pointer transition-colors duration-150 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                : "cursor-default"
            }`}
          >
            <PhaseIcon iconKey={iconKey}>
              {spinner ? (
                <MarkActivityIcon />
              ) : grouped ? (
                <IconStack2 size={glyphSize} stroke={2} />
              ) : (
                <ActivityGlyph kind={activityKind} size={glyphSize} />
              )}
            </PhaseIcon>
            {label && (
              <PhaseLabel
                text={label}
                shimmer={!final}
                ellipsis={!final}
                className={`max-w-[min(34rem,calc(100vw-5rem))] font-medium ${
                  final
                    ? "text-[13px]/5 text-muted-foreground"
                    : "text-[15px]/6"
                }`}
              />
            )}
            {grouped && (
              <motion.span
                aria-hidden
                animate={{ rotate: expanded ? 90 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
                className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
              >
                <IconChevronRight size={14} stroke={2.4} />
              </motion.span>
            )}
            {singleExpandable && (
              <IconChevronDown
                size={14}
                className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            )}
          </button>
          <AnimatePresence initial={false}>
            {expandable && expanded && (
              <motion.div
                key="activity-details"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { type: "spring", stiffness: 620, damping: 48 },
                  opacity: { duration: 0.18, ease: EASE_OUT },
                }}
                className="overflow-hidden"
              >
                <div className="mt-1 ml-2.5 flex flex-col border-l border-border py-0.5 pl-3">
                  {grouped
                    ? compact.map((phase, index) => (
                        <PhaseRow key={`${phase.kind}-${index}`} phase={phase} />
                      ))
                    : single && <PhaseDetailContent phase={single} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
},
/* Same reason as the cards: the settled disclosures above a streaming tail
   have nothing to say about the prose arriving under them. */
(previous, next) =>
  previous.status === next.status &&
  previous.thinking === next.thinking &&
  previous.active === next.active &&
  previous.settled === next.settled &&
  previous.animate === next.animate &&
  samePhases(previous.phases, next.phases));
