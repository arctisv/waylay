"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { IconCloudUpload } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";

import {
  attachmentRejectionReason,
  type AttachmentUpload,
  type FileLike,
} from "@/lib/attachments";
import { useAskBeforeBigPastePref } from "@/lib/chat-prefs";
import { useCoarsePointer } from "@/lib/coarse-pointer";
import { useDeploymentFeatures } from "@/lib/deployment-features";
import {
  effectiveGates,
  useSearchPref,
  useThinkingPref,
  type ComposerGates,
} from "@/lib/composer-gates";
import { useComposerModels } from "@/lib/model-catalog";
import { useModelFavorites } from "@/lib/model-favorites";
import type { SetModelPref } from "@/lib/model-pref";
import { pinRasterPath } from "@/lib/motion";
import { useAttachments } from "@/lib/use-attachments";
import { useVoiceInput, useVoiceInputSupported } from "@/lib/use-voice-input";
import { AttachMenu } from "./attach-menu";
import { MorphHeight } from "./morph-height";
import { ComposerAttachments } from "./composer-attachments";
import {
  useComposerCommandMenu,
  type CommandMenuContext,
} from "./composer-command-menu";
import { ModelSelect } from "./model-select";
import { ComposerQueue, type QueuedTurn } from "./composer-queue";
import { PasteChoiceDialog, type PasteChoice } from "./paste-choice-dialog";
import { SendButton } from "./send-button";
import { VoiceFace } from "./voice-face";

/* Grow with the text, but never past ~6 lines — past that it scrolls. */
const MAX_TEXTAREA_HEIGHT_PX = 160;

/* One shared empty list, so an absent prop never re-renders as "new". */
const NO_QUEUED: QueuedTurn[] = [];

/* gap-1.5 — the breathing room between the text and the pinned controls. */
const CONTROL_GAP_PX = 6;

/* Height of the controls row the textarea clears while expanded. */
const CONTROLS_ROW_PX = 36 + CONTROL_GAP_PX;

/* Expand shortly before the text reaches the model chip; collapse only
   once it's clearly short again. The window between the two is wider than
   a character, so typing at the boundary never oscillates. */
const EXPAND_BUFFER_PX = 16;
const COLLAPSE_BUFFER_PX = 40;

/* Pastes longer than this offer to become a .md attachment instead of a
   wall of composer text — same threshold as v1. */
const PASTE_AS_FILE_THRESHOLD = 300;

/* One spring for the whole morph: the textarea's height, its clearing
   margins, and therefore the pill's own height all move on this together.
   Tuned hot — the reshuffle should feel like a snap that happens to be
   smooth, not a glide. */
const MORPH_SPRING = {
  type: "spring",
  stiffness: 1100,
  damping: 60,
  mass: 0.45,
} as const;

/* The hand-off between the pill's faces (textarea ↔ voice);
   the MorphHeight wrapper springs the capsule between their heights. Opacity
   only — a filter here would sit under the floating face's backdrop blur.

   Sequenced, not cross-dissolved. popLayout stacks the two faces on top of
   each other to swap them, so a symmetric fade spends its whole middle
   showing both at half strength — a textarea, a model chip and a send button
   ghosting through a big microphone. The outgoing face clears out first and
   the incoming one follows it in, with only the dimmest few milliseconds
   overlapping. */
const FACE_SWAP = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.13, ease: "linear", delay: 0.06 },
  },
  exit: { opacity: 0, transition: { duration: 0.08, ease: "linear" } },
} as const;

/* The message bar. At rest it's one pill row — attach, text, model chip,
   send. When the text runs long (or grows a newline) it "makes room": the
   textarea sheds its side margins to take the full width and the controls
   get their own row beneath it. The controls never actually move — they're
   pinned to the pill's bottom corners, and the animated margins + height
   do all the pushing. Controlled from outside so suggestion cards (and
   later, drafts) can drop text in. */
export type { ComposerGates };

export function Composer({
  value,
  onValueChange,
  onSubmit,
  model,
  onModelChange,
  textareaRef,
  floating = false,
  isGenerating = false,
  onStop,
  onQueue,
  queued = NO_QUEUED,
  onDequeue,
  placeholder = "Ask anything",
}: {
  value: string;
  onValueChange: (value: string) => void;
  model: string;
  onModelChange: SetModelPref;
  /* `model` is a picker key ("Auto"/"Fast"/"Think"/"Max") — see
     lib/models.ts. A thrown rejection keeps the attachment tray intact for
     another go. */
  onSubmit: (
    text: string,
    model: string,
    attachments: AttachmentUpload[],
    gates: ComposerGates,
  ) => void | Promise<void>;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  /** Thread mode: the pill floats over the transcript, so its well goes
   *  translucent and picks up a backdrop blur. */
  floating?: boolean;
  /** While a reply is running the send button becomes Stop. */
  isGenerating?: boolean;
  onStop?: () => void;
  /** Files the draft to go once the running reply settles — the same
   *  payload as onSubmit. Absent where nothing could send it, and then
   *  Enter just parks the draft. */
  onQueue?: (
    text: string,
    model: string,
    attachments: AttachmentUpload[],
    gates: ComposerGates,
  ) => void | Promise<void>;
  /** What's already waiting, oldest first — stacked above the text. */
  queued?: QueuedTurn[];
  onDequeue?: (item: QueuedTurn) => void;
  /** Incognito swaps in its own line; everyone else gets the default. */
  placeholder?: string;
}) {
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? fallbackRef;
  const contentRef = useRef<HTMLDivElement>(null);
  const textBoxRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  /* The gates live here, not in the model picker — the command palette
     and the picker both read and write the same pair. Sticky across
     visits like the model pick (lib/composer-gates.ts), so thinking
     turned off stays off. */
  const [searchPref, setSearchOn] = useSearchPref();
  /* Web search is optional per deployment; without it the toggle hides
     and every send goes out without it. */
  const { search: searchAvailable } = useDeploymentFeatures();
  const searchOn = searchAvailable && searchPref;
  const [thinking, setThinking] = useThinkingPref();
  const coarsePointer = useCoarsePointer();
  const [expanded, setExpanded] = useState(false);
  /* Mirror of `expanded` for the measurement pass — hysteresis needs the
     previous answer without making the effect depend on (and loop on) it. */
  const expandedRef = useRef(false);
  const [textHeight, setTextHeight] = useState(36);
  const [insets, setInsets] = useState({ left: 42, right: 138 });
  /* Width ticks from the ResizeObserver — a re-measure trigger, so the
     breakpoint tracks sidebar drags and window resizes. */
  const [contentWidth, setContentWidth] = useState(0);

  /* A newline settles the expand decision on its own, which also means the
     width oracle below has nothing to say — so it stops laying the draft
     out while this holds. */
  const hasBreak = value.includes("\n");

  /* Dictation: a second face the pill wears while it's listening. The mic
     button and the plus menu both open it, and the transcript lands at the
     end of the draft — where a spoken sentence belongs, and the one place
     that's still meaningful after the textarea has been swapped out from
     under the caret. */
  const recorderReady = useVoiceInputSupported();
  const voice = useVoiceInput({
    onTranscript: (text) => {
      const spoken = text.trim();
      if (!spoken) return;
      const next =
        value.length > 0 && !/\s$/.test(value)
          ? `${value} ${spoken}`
          : `${value}${spoken}`;
      onValueChange(next);
      requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(next.length, next.length);
      });
    },
  });
  /* Without a recorder the affordance stays hidden rather than broken. */
  const voiceOffered = recorderReady;
  const voiceActive = voice.status !== "idle";
  const startVoice = voiceOffered ? voice.start : undefined;

  /* Is the message bar the face on screen? While it isn't, it is still
     MOUNTED — AnimatePresence keeps the outgoing face around for its fade,
     and popLayout pulls it out of flow to do it. Everything below that
     measures or reshapes the bar has to sit out that window, or it spends
     the fade rearranging a face that's on its way off screen. */
  const messageBarActive = !voiceActive;

  /* Re-observe on face swaps: the composer face (and contentRef with it)
     remounts when the voice face leaves, and an observer
     from a prior mount would be watching a detached node.

     Nothing is observed while another face owns the pill. popLayout's
     absolute positioning of the outgoing bar trips the observer, and the
     measurement pass downstream of it would then animate the textarea's
     margins and height mid-fade — the flicker this guard exists to stop. */
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content || !messageBarActive) return;
    const observer = new ResizeObserver(([entry]) =>
      setContentWidth(entry.contentRect.width),
    );
    observer.observe(content);
    return () => observer.disconnect();
  }, [messageBarActive]);

  /* The measurement pass: where would the text sit in the collapsed row,
     and how tall does the textarea want to be at its final width? All
     reads happen with temporary styles inside one layout effect — nothing
     in between paints. Skipped entirely while another face is up: the bar
     it would be measuring is the exiting one, laid out somewhere it will
     never be seen at. */
  useLayoutEffect(() => {
    const el = ref.current;
    const content = contentRef.current;
    const textBox = textBoxRef.current;
    const mirror = mirrorRef.current;
    const plus = plusRef.current;
    const right = rightRef.current;
    if (!messageBarActive) return;
    if (!el || !content || !textBox || !mirror || !plus || !right) return;

    const left = plus.offsetWidth + CONTROL_GAP_PX;
    const rightZone = right.offsetWidth + CONTROL_GAP_PX;
    /* Only when they actually moved (the model chip changing width) — a
       fresh object every keystroke bought an extra render pass for nothing. */
    setInsets((current) =>
      current.left === left && current.right === rightZone
        ? current
        : { left, right: rightZone },
    );

    /* clientWidth minus the p-2 frame, minus the textarea's own px-1.5. */
    const fullInner = content.clientWidth - 16 - 12;
    const collapsedInner = fullInner - left - rightZone;
    const textWidth = mirror.offsetWidth;
    const nextExpanded =
      hasBreak ||
      (expandedRef.current
        ? textWidth > collapsedInner - COLLAPSE_BUFFER_PX
        : textWidth > collapsedInner - EXPAND_BUFFER_PX);
    expandedRef.current = nextExpanded;
    setExpanded(nextExpanded);

    /* Measure the wanted height at the width the box is heading for, not
       the width it's animating through. */
    const prevMarginLeft = textBox.style.marginLeft;
    const prevMarginRight = textBox.style.marginRight;
    const prevHeight = el.style.height;
    textBox.style.marginLeft = nextExpanded ? "0px" : `${left}px`;
    textBox.style.marginRight = nextExpanded ? "0px" : `${rightZone}px`;
    el.style.height = "0px";
    setTextHeight(Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX));
    textBox.style.marginLeft = prevMarginLeft;
    textBox.style.marginRight = prevMarginRight;
    el.style.height = prevHeight;
  }, [value, hasBreak, model, contentWidth, messageBarActive, ref]);

  /* Attachments are read as they're picked; validity is model-relative,
     so a chip can flip to rejected on a model switch without re-adding. */
  const attachments = useAttachments();
  const models = useComposerModels();
  const currentModel =
    models.find((entry) => entry.key === model) ?? models[0];
  const rejectionFor = (file: FileLike) =>
    attachmentRejectionReason(file, currentModel);
  const hasInvalidFiles = attachments.drafts.some(
    (draft) => draft.status === "error" || rejectionFor(draft) !== null,
  );

  const [sending, setSending] = useState(false);
  /* Nothing typed and nothing attached — what the mic button waits for. */
  const composerEmpty =
    value.length === 0 && attachments.drafts.length === 0;
  const canSend =
    (value.trim().length > 0 || attachments.drafts.length > 0) &&
    !hasInvalidFiles &&
    !sending;
  /* Send and queue are the same message going two places, so they share
     one funnel; only the handler differs. */
  const dispatch = async (handler: typeof onSubmit) => {
    if (!canSend) return;
    setSending(true);
    try {
      /* Waits out any file still being read — send during a read just
         means the message leaves the moment the text lands. A rejected
         handler skips the clear, so nothing typed or attached is lost.
         The gates go out through effectiveGates — the exact state the
         picker chip shows, never a raw level the model can't run. */
      const files = await attachments.resolve();
      await handler(
        value.trim(),
        model,
        files,
        effectiveGates(currentModel, { search: searchOn, thinking }),
      );
      attachments.clear();
    } catch {
      /* The handler already surfaced the failure (toast); the draft and
         tray stay put for another go. */
    } finally {
      setSending(false);
    }
  };
  const submit = async () => {
    /* One reply at a time — while generating, the button is Stop and
       Enter parks the draft right where it is (or queues it, below). */
    if (isGenerating) return;
    await dispatch(onSubmit);
  };
  /* While a reply is being written, a draft can go on the queue instead:
     it sends itself the moment the reply settles. Enter takes this path
     whenever the pill is worn, so typing ahead needs no extra key. */
  const canQueue = isGenerating && onQueue !== undefined;
  const queue = async () => {
    if (!canQueue) return;
    await dispatch(onQueue);
  };

  /* Big-paste choice: past the threshold (and while the pref says to ask)
     the paste is intercepted and the dialog decides — inline text, or a
     pasted-text.md attachment through the normal upload pipeline. */
  const [askBeforeBigPaste, setAskBeforeBigPaste] = useAskBeforeBigPastePref();
  const [pendingPaste, setPendingPaste] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);

  const resolvePaste = (choice: PasteChoice, dontAskAgain: boolean) => {
    if (dontAskAgain) setAskBeforeBigPaste(false);
    const pending = pendingPaste;
    setPendingPaste(null);
    if (!pending) return;
    if (choice === "attachment") {
      attachments.addFiles([
        new File([pending.text], "pasted-text.md", { type: "text/markdown" }),
      ]);
      return;
    }
    onValueChange(
      value.slice(0, pending.start) + pending.text + value.slice(pending.end),
    );
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const caret = pending.start + pending.text.length;
      el.setSelectionRange(caret, caret);
    });
  };

  /* Window-level drag-and-drop: anywhere on the page counts, a counter
     survives nested enter/leave, and the overlay only appears for drags
     that actually carry files. */
  const [dragging, setDragging] = useState(false);
  const { addFiles } = attachments;
  useEffect(() => {
    /* While the pill is listening there's no tray on screen to drop into. */
    const accepting = !voiceActive;
    let depth = 0;
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event) || !accepting) return;
      depth += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (hasFiles(event) && accepting) event.preventDefault();
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event) || !accepting) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      if (event.dataTransfer?.files.length) addFiles(event.dataTransfer.files);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles, voiceActive]);

  /* The "/" command palette: models and gates without leaving the
     keyboard. It reads the same state the chips edit. */
  const { favorites } = useModelFavorites();
  const commandContext = useMemo<CommandMenuContext>(
    () => ({
      model,
      setModel: onModelChange,
      searchAvailable,
      searchOn,
      setSearchOn,
      thinking,
      setThinking,
      models,
      favorites,
    }),
    [
      model,
      onModelChange,
      searchAvailable,
      searchOn,
      setSearchOn,
      thinking,
      setThinking,
      models,
      favorites,
    ],
  );

  const commandMenu = useComposerCommandMenu({
    value,
    onValueChange,
    textareaRef: ref,
    context: commandContext,
  });

  /* Use a real border here instead of the shared inset highlight. Chromium
     can flash the top edge of an inset shadow when this blurred pill sits
     on a transformed floating dock.

     The pill has two faces — the message bar and the voice face — that
     crossfade inside one height morph, so dictation starting (or ending)
     reshapes the capsule on a spring instead of a snap. The
     command palette lives outside the morph: its popup opens above the
     pill and must never be clipped by the morph's overflow-hidden. */
  return (
    <div
      className={`relative rounded-[26px] border border-[var(--well-outline)] ${
        floating
          ? "bg-(--well-translucent) backdrop-blur-xl"
          : "bg-well"
      }`}
    >
      {/* selfSizing while the message bar is up: the textbox below springs
          its own height, so the capsule must not spring along behind it —
          two springs on one height clipped the controls row off on every
          newline. The voice face doesn't animate its own height, so it gets
          the capsule's spring. */}
      <MorphHeight selfSizing={!voiceActive}>
        <AnimatePresence mode="popLayout" initial={false}>
          {voiceActive ? (
            <motion.div
              key="voice"
              {...FACE_SWAP}
              transformTemplate={pinRasterPath}
            >
              <VoiceFace voice={voice} />
            </motion.div>
          ) : (
            <motion.div
              key="composer"
              {...FACE_SWAP}
              transformTemplate={pinRasterPath}
            >
              <div ref={contentRef} className="relative p-2">
                {/* Queued messages stack above everything else in the pill:
                    they go before whatever is being typed. The rows animate
                    their own heights, so the pill follows them. */}
                {queued.length > 0 && (
                  <ComposerQueue items={queued} onRemove={onDequeue} />
                )}
                {/* The tray sits in normal flow above the textbox, so its reveal
                    grows the whole pill on the same spring everything else rides. */}
                <AnimatePresence initial={false}>
                  {attachments.drafts.length > 0 && (
                    <motion.div
                      key="attachments"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: MORPH_SPRING,
                        opacity: { duration: 0.15, ease: "linear" },
                      }}
                      className="overflow-hidden"
                    >
                      <ComposerAttachments
                        drafts={attachments.drafts}
                        rejectionFor={rejectionFor}
                        onRemove={attachments.remove}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.div
                  ref={textBoxRef}
                  initial={false}
                  animate={{
                    marginLeft: expanded ? 0 : insets.left,
                    marginRight: expanded ? 0 : insets.right,
                    marginBottom: expanded ? CONTROLS_ROW_PX : 0,
                    height: textHeight,
                  }}
                  transition={MORPH_SPRING}
                  className="relative"
                >
                  <textarea
                    ref={ref}
                    value={value}
                    rows={1}
                    autoFocus
                    onChange={(event) => onValueChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (commandMenu.onKeyDown(event)) return;
                      /* Touch keyboards have no Shift+Enter — there, Enter falls
                         through to a newline and sending stays on the button. */
                      if (event.key === "Enter" && !event.shiftKey && !coarsePointer) {
                        event.preventDefault();
                        void (canQueue ? queue() : submit());
                      }
                    }}
                    onPaste={(event) => {
                      const files = event.clipboardData?.files;
                      if (files && files.length > 0) {
                        event.preventDefault();
                        attachments.addFiles(files);
                        return;
                      }
                      const text = event.clipboardData?.getData("text") ?? "";
                      if (text.length > PASTE_AS_FILE_THRESHOLD && askBeforeBigPaste) {
                        event.preventDefault();
                        const el = event.currentTarget;
                        setPendingPaste({
                          text,
                          start: el.selectionStart ?? value.length,
                          end: el.selectionEnd ?? el.selectionStart ?? value.length,
                        });
                      }
                    }}
                    placeholder={placeholder}
                    className="relative block h-full w-full resize-none overflow-y-auto bg-transparent px-1.5 py-1.5 field-text caret-foreground outline-none placeholder:text-muted-foreground"
                  />
                </motion.div>
                {/* The width oracle: same text, same type, laid on one unwrapped
                    line — its width is where the caret would be. Left empty
                    once the draft has a newline: the answer is settled either
                    way, and laying a long draft out as one unwrapped line is
                    the expensive half of the measurement pass. */}
                <span
                  ref={mirrorRef}
                  aria-hidden
                  className="invisible absolute top-0 left-0 block w-max px-1.5 field-text whitespace-pre"
                >
                  {hasBreak ? "" : value}
                </span>
                <div ref={plusRef} className="absolute bottom-2 left-2">
                  <AttachMenu
                    onFiles={attachments.addFiles}
                    onVoice={startVoice}
                  />
                </div>
                <div
                  ref={rightRef}
                  className="absolute right-2 bottom-2 flex items-center gap-1.5"
                >
                  <ModelSelect
                    value={model}
                    onValueChange={onModelChange}
                    searchAvailable={searchAvailable}
                    searchOn={searchOn}
                    onSearchOnChange={setSearchOn}
                    thinking={thinking}
                    onThinkingChange={setThinking}
                  />
                  <SendButton
                    state={
                      isGenerating && onStop
                        ? /* Empty means Stop; the first character typed
                             turns it into Queue, the way the mic hands
                             over to Send below. */
                          canQueue && !composerEmpty
                          ? "queue"
                          : "stop"
                        : sending
                          ? "sending"
                          : /* Nothing to send yet, so the button offers the
                               other way to fill the pill. A single typed
                               character (even a space) hands it back — the
                               test is emptiness, not sendability, so a
                               draft that can't send still shows why. */
                            voiceOffered && composerEmpty
                            ? "voice"
                            : "send"
                    }
                    canSend={canSend}
                    onSend={() => void submit()}
                    onStop={onStop}
                    onQueue={() => void queue()}
                    onVoice={startVoice}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </MorphHeight>
      {commandMenu.element}
      <PasteChoiceDialog
        open={pendingPaste !== null}
        charCount={pendingPaste?.text.length ?? 0}
        onChoose={resolvePaste}
        onOpenChange={(next) => {
          if (!next) setPendingPaste(null);
        }}
      />
      {/* Whole-window drop target: dragging files anywhere surfaces this,
          dropping lands them in the tray. */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "linear" }}
            className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center rounded-3xl border-2 border-dashed border-foreground/25 bg-background/70 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <IconCloudUpload size={28} stroke={1.8} />
              <span className="text-sm font-medium">Drop files to attach</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
