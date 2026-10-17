"use client";

import { useState } from "react";
import {
  IconBookmark,
  IconBrain,
  IconCalculator,
  IconChevronDown,
  IconCpu,
  IconPhoto,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";

import type { MessagePhase } from "@/lib/messages";
import { EASE_OUT } from "@/lib/motion";
import { completedLabel } from "@/lib/phase-activity";
import { claimScrollIntent } from "@/lib/scroll-intent";
import { PhaseIcon, PhaseLabel } from "./phase-motion";
import { CalcBody } from "./calc-body";

function PhaseGlyph({ kind }: { kind: string }) {
  switch (kind) {
    case "thought":
      return <IconBrain size={15} stroke={2} />;
    case "calc":
      return <IconCalculator size={15} stroke={2} />;
    case "memory":
      return <IconBookmark size={15} stroke={2} />;
    case "image":
      return <IconPhoto size={15} stroke={2} />;
    default:
      return <IconCpu size={15} stroke={2} />;
  }
}

/* What a row can open to: the model's reasoning, the sums behind a
   calculation, or the fact it saved to memory. */
export function phaseDisclosure(phase: MessagePhase) {
  const trace =
    phase.kind === "thought"
      ? phase.text?.trim()
      : phase.kind === "memory"
        ? phase.label?.trim()
        : undefined;
  return {
    trace,
    expandable:
      Boolean(trace) ||
      (phase.kind === "calc" &&
        (Boolean(phase.result || phase.error || phase.expression) ||
          Boolean(phase.items?.length))),
  };
}

export function PhaseDetailContent({ phase }: { phase: MessagePhase }) {
  const { trace } = phaseDisclosure(phase);
  if (phase.kind === "calc") return <CalcBody phase={phase} />;
  return trace ? (
    <div className="py-1 text-[13px]/5.5 whitespace-pre-wrap text-muted-foreground">
      {trace}
    </div>
  ) : null;
}

export function PhaseRow({ phase }: { phase: MessagePhase }) {
  const [open, setOpen] = useState(false);
  const { expandable } = phaseDisclosure(phase);
  const label = completedLabel(phase);

  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={!expandable}
        onClick={(event) => {
          claimScrollIntent(event.currentTarget);
          setOpen((current) => !current);
        }}
        aria-expanded={expandable ? open : undefined}
        className={`-mx-1 flex max-w-full items-center gap-2 rounded-md px-1 py-0.5 text-left ${
          expandable
            ? "cursor-pointer transition-colors duration-150 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
            : "cursor-default"
        }`}
      >
        <PhaseIcon iconKey={`phase-${phase.kind}`}>
          <PhaseGlyph kind={phase.kind} />
        </PhaseIcon>
        <PhaseLabel
          text={label}
          className="max-w-[min(32rem,calc(100vw-7rem))] text-[13px]/5 font-medium text-muted-foreground"
        />
        {expandable && (
          <IconChevronDown
            size={13}
            className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expandable && open && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: "spring", stiffness: 650, damping: 50 },
              opacity: { duration: 0.18, ease: EASE_OUT },
            }}
            className="overflow-hidden"
          >
            <div className="mt-1 mb-1 ml-2.5 border-l border-border pl-3">
              <PhaseDetailContent phase={phase} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
