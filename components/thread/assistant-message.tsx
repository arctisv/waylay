"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  IconAlertTriangleFilled,
  IconCheck,
  IconCopy,
  IconPlayerStopFilled,
  IconRefresh,
  IconVolume,
} from "@tabler/icons-react";
import { useQuery } from "@/lib/local/react";
import { api } from "@/lib/local/api";

import {
  clearAssistantStream,
  rememberDisplayedAssistantText,
} from "@/lib/assistant-stream";
import {
  assistantActivityState,
  furthestAssistantText,
} from "@/lib/assistant-state";
import {
  isTerminal,
  parseMessageError,
  type ChatMessage,
  type MessageError,
} from "@/lib/messages";
import { buildMessageRenderPlan } from "@/lib/message-render-plan";
import { isCompactPhase } from "@/lib/phase-activity";
import { toggleReadAloud, useCanReadAloud, useReadingAloud } from "@/lib/read-aloud";
import { useTypewriter } from "@/lib/use-typewriter";
import { CheckpointMenu } from "./checkpoint-menu";
import { Markdown } from "./markdown";
import { MessageActionButton } from "./message-action-button";
import { MessageStats } from "./message-stats";
import { PhaseActivity } from "./phase-activity";

/* One assistant turn. Text arrives two ways — the reactive getStreamBody
   query while the on-device turn is in flight, or the finished row itself
   — and either way a typewriter meters the reveal so bursts never lurch.
   A failed reply carries its reason as content; it renders as a flat
   banner instead of prose.

   Key instances by `${id}:${streamId}` — a retry swaps the stream and the
   typewriter should start over. */

export function AssistantMessage({
  message,
  onRetry,
  onBranch,
  onRollback,
}: {
  message: ChatMessage;
  /** Reset this reply and run it again — absent (debug page, other tabs'
   *  live turns) hides the retry affordances. */
  onRetry?: () => void;
  /** Copy the thread up to here into a fresh one — absent hides the
   *  checkpoint menu entirely. */
  onBranch?: () => void;
  /** Delete everything after this reply — absent (nothing follows, or a
   *  reply is mid-flight) hides the rollback item. */
  onRollback?: () => void;
}) {
  const terminal = isTerminal(message.status);

  /* Whether this mount caught the message mid-flight — old messages paint
     instantly, live ones type. Captured once: a retry remounts (the
     transcript keys on streamId), so a terminal message can't come back
     to life inside one mount. */
  const [sawLive] = useState(!terminal);

  /* The reply body, live from the model's stream buffer. */
  const persisted = useQuery(
    api.messages.getStreamBody,
    !terminal && message.streamId ? { streamId: message.streamId } : "skip",
  ) as { text: string; status: string } | undefined;

  /* Keep both snapshots in play during the terminal handoff — the finished
     row and the stream body can lead each other by a render or two. */
  const sourceText = terminal
    ? message.content
    : furthestAssistantText(persisted?.text, message.content);
  const stopped = message.status === "stopped";
  const { text, caughtUp } = useTypewriter(sourceText, sawLive, stopped);

  /* Stop is handled outside this component. Keep its action layer informed
     of the exact committed typewriter frame so it can freeze here instead
     of persisting the stream buffer that has not been shown yet. */
  useLayoutEffect(() => {
    if (!message.streamId || terminal) return;
    rememberDisplayedAssistantText(message.streamId, text);
  }, [message.streamId, terminal, text]);

  /* Release the stream record when this mount stops being the live view of
     it — settling, retrying onto a fresh stream, or unmounting entirely.
     The cleanup shape matters: hopping threads (or heading home) mid-reply
     unmounts before terminal ever lands here, and clearing only on the
     settled render stranded the full painted text in the module Map for
     the rest of the session, one reply at a time. */
  useEffect(() => {
    const streamId = message.streamId;
    if (!streamId || terminal) return;
    return () => clearAssistantStream(streamId);
  }, [terminal, message.streamId]);

  const streamFailed =
    persisted?.status === "error" || persisted?.status === "timeout";
  const error: MessageError | null =
    message.status === "error"
      ? parseMessageError(message.content)
      : streamFailed
        ? { kind: "generic" }
        : null;

  const streamingNow = !terminal && !error;
  const showText = !error && text.length > 0;
  const phases = useMemo(() => message.phases ?? [], [message.phases]);
  /* Once compact tool work begins, its activity stays in progress through
     inter-call gaps. Only the terminal message update settles the summary. */
  const {
    active: activityActive,
    settled: activitySettled,
  } = assistantActivityState({
    phases,
    terminal,
    canShowActivity: streamingNow,
    showText,
  });
  const renderableText = error ? "" : text;
  const renderPlan = useMemo(
    () => buildMessageRenderPlan(renderableText, phases),
    [phases, renderableText],
  );
  const hasCompactItems = renderPlan.some(
    (item) =>
      item.type === "group" ||
      (item.type === "phase" && isCompactPhase(item.phase)),
  );
  /* The live indicator is ONE persistent element (the slot after the plan
     below) so phase-to-phase changes morph in place. Keyed plan items
     remount as the plan restructures (phase-0 + phase-1 collapse into
     group-0, a single grows into a group), which replaced the icon and
     label instantly on every transition. The last compact run renders
     through the slot — live and settled, so the final morph stays in
     place too — for as long as only prose follows it; anything later (a
     rich card, a newer run) sends it back to the plan as a settled row. */
  let lastNonTextIndex = -1;
  for (let i = renderPlan.length - 1; i >= 0; i--) {
    if (renderPlan[i].type !== "text") {
      lastNonTextIndex = i;
      break;
    }
  }
  const lastNonTextItem =
    lastNonTextIndex >= 0 ? renderPlan[lastNonTextIndex] : undefined;
  const ownedIndex =
    lastNonTextItem &&
    (lastNonTextItem.type === "group" ||
      (lastNonTextItem.type === "phase" && isCompactPhase(lastNonTextItem.phase)))
      ? lastNonTextIndex
      : -1;
  const ownedItem = ownedIndex >= 0 ? renderPlan[ownedIndex] : undefined;
  const ownedPhases =
    ownedItem?.type === "group"
      ? ownedItem.phases.map(({ phase }) => phase)
      : ownedItem?.type === "phase"
        ? [ownedItem.phase]
        : undefined;
  const ownedIsTrailing = ownedIndex === renderPlan.length - 1;

  /* Stable key = stable element: React matches it across renders even as
     its position in the children array shifts, so the indicator survives
     every plan restructure and its AnimatePresence gets to morph. */
  const liveActivity = (
    <div
      key="live-activity"
      className={
        ownedIndex > 0 && renderPlan[ownedIndex - 1]?.type === "text"
          ? "mt-1.5 w-full min-w-0"
          : "w-full min-w-0"
      }
    >
      <PhaseActivity
        phases={ownedPhases ?? phases}
        status={message.status}
        thinking={message.thinking === true}
        active={(ownedItem ? ownedIsTrailing : true) && activityActive}
        settled={
          ownedItem ? !ownedIsTrailing || activitySettled : activitySettled
        }
        animate={sawLive}
      />
    </div>
  );

  const planChildren = renderPlan.map((item, index) => {
    if (index === ownedIndex) return liveActivity;
    if (item.type === "text") {
      const trailing =
        item.startOffset + item.text.length >= renderableText.length;
      return (
        <Markdown
          key={item.key}
          streaming={(streamingNow || !caughtUp) && trailing}
        >
          {item.text}
        </Markdown>
      );
    }

    const afterText = index > 0 && renderPlan[index - 1]?.type === "text";
    const wrapperClass = afterText
      ? "mt-1.5 w-full min-w-0"
      : "w-full min-w-0";
    if (item.type === "group") {
      return (
        <div key={item.key} className={wrapperClass}>
          <PhaseActivity
            phases={item.phases.map(({ phase }) => phase)}
            status={message.status}
            thinking={message.thinking === true}
            active={false}
            settled
            animate={sawLive}
          />
        </div>
      );
    }
    if (isCompactPhase(item.phase)) {
      return (
        <div key={item.key} className={wrapperClass}>
          <PhaseActivity
            phases={[item.phase]}
            status={message.status}
            thinking={message.thinking === true}
            active={false}
            settled
            animate={sawLive}
          />
        </div>
      );
    }
    /* Every on-device phase is compact; anything else has no surface. */
    return null;
  });
  /* No compact run owns the slot yet (fresh turn, or a prose-only reply):
     the indicator still mounts — in the same keyed array, so the spinner
     morphs into the first phase instead of being replaced. */
  if (!ownedItem && !hasCompactItems) planChildren.push(liveActivity);

  return (
    <div
      data-quotable="assistant"
      className="group/msg flex w-full min-w-0 flex-col items-start"
    >
      {planChildren}
      {error && <ErrorBanner error={error} onRetry={onRetry} />}
      {message.status === "stopped" && (
        <div className="mt-2 flex items-center gap-1.5 text-[13px]/4 font-medium text-muted-foreground">
          <IconPlayerStopFilled size={12} />
          Stopped
        </div>
      )}
      {!terminal && showText && (
        /* The completed hover controls are mt-1.5 + h-7. Reserve that exact
           footprint while prose streams so their terminal-state mount cannot
           change the message height or kick the scroll anchor. */
        <div aria-hidden className="mt-1.5 h-7" />
      )}
      {terminal && !error && (
        <MessageActions
          message={message}
          onRetry={onRetry}
          onBranch={onBranch}
          onRollback={onRollback}
        />
      )}
    </div>
  );
}

function ErrorBanner({
  error,
  onRetry,
}: {
  error: MessageError;
  onRetry?: () => void;
}) {
  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-well px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <IconAlertTriangleFilled
          size={17}
          className="mt-0.5 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0">
          <div className="text-[14px]/5 font-medium">Something went wrong.</div>
          <div className="mt-0.5 text-[13px]/5 text-muted-foreground">
            {error.detail ?? "The reply didn't make it. Try again?"}
          </div>
        </div>
      </div>
      {onRetry && (
        <div className="flex items-center gap-2 pl-[27.5px]">
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer rounded-full bg-primary px-3 py-1.5 text-[13px]/4 font-medium text-primary-foreground transition-[background-color,scale] duration-150 hover:bg-(--primary-hover) active:scale-[0.96]"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function MessageActions({
  message,
  onRetry,
  onBranch,
  onRollback,
}: {
  message: ChatMessage;
  onRetry?: () => void;
  onBranch?: () => void;
  onRollback?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = message.content;
  const canCopy = text.length > 0;
  const canSpeak = useCanReadAloud() && canCopy;
  const reading = useReadingAloud(message.id);
  const hasStats =
    message.outputTokens !== undefined || message.durationMs !== undefined;
  if (!canCopy && !onRetry && !onBranch && !hasStats) return null;

  return (
    /* has-data-popup-open keeps the row lit while the checkpoint menu is
       up — the pointer is off in the portal by then. */
    <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100 focus-within:opacity-100 has-data-popup-open:opacity-100 coarse:opacity-100">
      {canCopy && (
        <MessageActionButton
          label="Copy message"
          tooltip={copied ? "Copied" : "Copy message"}
          onClick={() => {
            navigator.clipboard
              .writeText(text)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
              .catch(() => {});
          }}
        >
          {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
        </MessageActionButton>
      )}
      {canSpeak && (
        <MessageActionButton
          label={reading ? "Stop reading" : "Read aloud"}
          onClick={() => toggleReadAloud(message.id, text)}
        >
          {reading ? <IconPlayerStopFilled size={13} /> : <IconVolume size={15} />}
        </MessageActionButton>
      )}
      {onRetry && (
        <MessageActionButton label="Retry message" onClick={onRetry}>
          <IconRefresh size={15} />
        </MessageActionButton>
      )}
      {onBranch && <CheckpointMenu onBranch={onBranch} onRollback={onRollback} />}
      <MessageStats
        outputTokens={message.outputTokens}
        durationMs={message.durationMs}
      />
    </div>
  );
}
