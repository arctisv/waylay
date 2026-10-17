"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  IconBrain,
  IconCheck,
  IconChevronDown,
  IconLoader2,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";

import { clampThinking } from "@/lib/composer-gates";
import { scoreText } from "@/lib/model-search";
import { pinRasterPath } from "@/lib/motion";
import {
  THINKING_LABELS,
  type ComposerModel,
  type ThinkingLevel,
} from "@/lib/models";
import { ModelGlyph } from "./model-glyph";

/* The composer's command palette: typing "/" at a word boundary opens it
   above the pill. One flat list — no section headers — covering model
   switching and the thinking gate. At rest only the pinned models show;
   typing (after a beat) searches every model, entirely client-side. */

export type CommandTrigger = { start: number; char: "/"; query: string };

/* How long typing has to settle before the full model catalog joins the
   candidates — keeps the bare palette calm without making search feel
   gated. Long enough for the searching shimmer to read as a beat, not a
   flicker. */
const SEARCH_DEBOUNCE_MS = 350;

/* Scan left from the caret: the trigger char must sit at the start or
   after whitespace, and the query between it and the caret must be one
   unbroken word — a space closes the palette. */
export function detectCommandTrigger(
  value: string,
  caret: number,
): CommandTrigger | null {
  if (caret < 1) return null;
  for (let i = caret - 1; i >= 0; i--) {
    const ch = value[i];
    if (ch === "/") {
      const prev = value[i - 1];
      if (i !== 0 && !/\s/.test(prev ?? "")) return null;
      const query = value.slice(i + 1, caret);
      if (/\s/.test(query)) return null;
      return { start: i, char: ch, query };
    }
    if (/\s/.test(ch)) return null;
  }
  return null;
}

type Command = {
  id: string;
  label: string;
  /** Company subtitle for catalog models. */
  sub?: string;
  glyph: ReactNode;
  /** Replaces the "/query" text on select. Absent = the trigger text just
      vanishes. */
  insertText?: string;
  keywords?: string[];
  /** Right-aligned status text ("On", "Low"). */
  hint?: string;
  selected?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  /** Selecting runs onSelect but keeps the palette (and trigger) open —
      for rows that unfold in place instead of finishing the command. */
  keepOpen?: boolean;
  /** Wears a chevron; `expanded` flips it while the sub-rows are out. */
  expandable?: boolean;
  expanded?: boolean;
  onSelect: () => void;
};

/* One scored pass over the whole flat list: label and keywords both
   count, better matches float up, ties keep their standing order.

   Scoring is shared with the model picker (lib/model-search), so
   punctuation folds away on both sides. Still not fuzzy — a palette
   should be predictable, not clever. */
function filterCommands(commands: Command[], query: string): Command[] {
  if (!query) return commands;
  const scored: { command: Command; index: number; score: number }[] = [];
  commands.forEach((command, index) => {
    const haystacks = [command.label, ...(command.keywords ?? [])];
    let best = 0;
    for (const haystack of haystacks) {
      best = Math.max(best, scoreText(haystack, query));
    }
    if (best > 0) scored.push({ command, index, score: best });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((entry) => entry.command);
}

export type CommandMenuContext = {
  model: string;
  setModel: (key: string) => void;
  thinking: ThinkingLevel;
  setThinking: (level: ThinkingLevel) => void;
  models: ComposerModel[];
  favorites: ReadonlySet<string>;
};

function buildCommands(
  ctx: CommandMenuContext,
  {
    searching,
    thinkingOpen,
    onToggleThinking,
  }: {
    searching: boolean;
    thinkingOpen: boolean;
    onToggleThinking: () => void;
  },
): Command[] {
  const current =
    ctx.models.find((model) => model.key === ctx.model) ?? ctx.models[0];

  /* At rest: the user's pinned models (the picker's compact list, same
     fallback to the preset tiers when nothing's starred). Searching: every
     model. */
  const pinned = ctx.models.filter((model) => ctx.favorites.has(model.key));
  const restingModels = pinned.length > 0 ? pinned : ctx.models;
  const modelPool = searching ? ctx.models : restingModels;

  const modelCommands: Command[] = modelPool.map((model) => ({
    id: `model:${model.key}`,
    label: model.fullName ?? model.name,
    glyph: (
      <ModelGlyph
        model={model}
        size={15}
        className="shrink-0 text-muted-foreground"
      />
    ),
    keywords: ["model", "switch", ...model.aliases],
    selected: ctx.model === model.key,
    onSelect: () => ctx.setModel(model.key),
  }));

  /* Same gate math as the model picker: Auto runs the gate itself. */
  const gatesLocked = current?.autoGates ?? false;
  const levels = current?.thinkingLevels ?? ["none"];
  const level = clampThinking(current, ctx.thinking);
  const gateDisabledHint =
    current?.key === "Auto" ? "Auto decides" : "Not on this model";
  const thinkingHint = gatesLocked
    ? current?.key === "Auto"
      ? "Auto"
      : "None"
    : THINKING_LABELS[level];

  /* Thinking unfolds in place: selecting the row opens the level list
     right under it (the palette-only dropdown — the model picker keeps
     its cycle), and picking a level finishes the command. */
  const thinkingDisabled = gatesLocked || levels.length < 2;
  const gateCommands: Command[] = [
    {
      id: "gate:thinking",
      label: "Thinking",
      glyph: (
        <IconBrain
          size={15}
          stroke={2.25}
          className="shrink-0 text-muted-foreground"
        />
      ),
      keywords: ["reasoning", "reason", "think", "toggle", "level"],
      hint: thinkingHint,
      disabled: thinkingDisabled,
      disabledHint: gateDisabledHint,
      keepOpen: true,
      expandable: !thinkingDisabled,
      expanded: thinkingOpen,
      onSelect: onToggleThinking,
    },
    ...(thinkingOpen && !thinkingDisabled
      ? levels.map(
          (option): Command => ({
            id: `gate:thinking:${option}`,
            label: THINKING_LABELS[option],
            glyph: <span aria-hidden className="w-[15px] shrink-0" />,
            keywords: ["thinking", option],
            selected: option === level,
            onSelect: () => ctx.setThinking(option),
          }),
        )
      : []),
  ];

  return [...modelCommands, ...gateCommands];
}

const POP = {
  initial: { opacity: 0, y: 8, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 6, scale: 0.98 },
  transition: {
    y: { type: "spring", stiffness: 900, damping: 55, mass: 0.5 },
    scale: { type: "spring", stiffness: 900, damping: 55, mass: 0.5 },
    opacity: { duration: 0.12, ease: "linear" },
  },
} as const;

/* Entrance for the searching notice: a soft rise-and-fade on mount only —
   exits stay instant (search-modal rules; lingering fade-outs read as
   flicker). */
const POP_IN = {
  initial: { opacity: 0, y: 5 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: [0.22, 0.61, 0.36, 1] as const },
  transformTemplate: pinRasterPath,
} as const;

/* The container spring is the only list animation — content swaps
   instantly and the spring keeps momentum across per-keystroke retargets,
   same recipe as the search modal. */
const HEIGHT_SPRING = {
  type: "spring",
  stiffness: 700,
  damping: 50,
  mass: 0.6,
} as const;

export function useComposerCommandMenu({
  value,
  onValueChange,
  textareaRef,
  context,
  mentionSpans,
}: {
  value: string;
  onValueChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  context: CommandMenuContext;
  /** Text spans of settled mention chips — a trigger that lands exactly
      on one (caret at a chip's end) stays quiet instead of reopening the
      palette every time the caret hops across it. */
  mentionSpans?: { start: number; end: number }[];
}) {
  const [trigger, setTrigger] = useState<CommandTrigger | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  /* The thinking row's unfolded level list. */
  const [thinkingOpen, setThinkingOpen] = useState(false);
  /* After unfolding, land the highlight on the current level instead of
     snapping back to the top of the list. */
  const [wantThinkingFocus, setWantThinkingFocus] = useState(false);
  /* Escape parks the palette for this token only — retyping in the same
     token stays quiet; a fresh trigger reopens it. */
  const dismissedStart = useRef<number | null>(null);
  const pendingCaret = useRef<number | null>(null);

  /* refresh() runs from listeners attached once, so the spans ride a ref
     to stay current. */
  const mentionSpansRef = useRef(mentionSpans ?? []);
  useEffect(() => {
    mentionSpansRef.current = mentionSpans ?? [];
  }, [mentionSpans]);

  const refresh = () => {
    const el = textareaRef.current;
    if (!el) return;
    let next = detectCommandTrigger(el.value, el.selectionStart ?? 0);
    if (
      next !== null &&
      mentionSpansRef.current.some(
        (span) =>
          next !== null &&
          next.start === span.start &&
          next.start + 1 + next.query.length === span.end,
      )
    ) {
      next = null;
    }
    if (next === null || next.start !== dismissedStart.current) {
      dismissedStart.current = null;
    }
    setTrigger((prev) => {
      if (next === null) return prev === null ? prev : null;
      if (next.start === dismissedStart.current) return null;
      if (
        prev &&
        prev.start === next.start &&
        prev.char === next.char &&
        prev.query === next.query
      ) {
        return prev;
      }
      return next;
    });
  };

  /* Re-detect after every value commit (rAF so the DOM caret has moved),
     and on caret hops from clicks/arrow keys. */
  useEffect(() => {
    const id = requestAnimationFrame(refresh);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  /* Deliberately no dep array: the textarea remounts on composer face
     swaps (question form, voice), and an effect keyed on the stable ref
     object would stay bound to the detached node forever. Re-binding two
     listeners per render is nothing; being wired to the live textarea is
     everything. */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const onCaretMove = () => refresh();
    el.addEventListener("click", onCaretMove);
    el.addEventListener("keyup", onCaretMove);
    return () => {
      el.removeEventListener("click", onCaretMove);
      el.removeEventListener("keyup", onCaretMove);
    };
  });

  /* Restore the caret after an imperative value swap. */
  useEffect(() => {
    if (pendingCaret.current === null) return;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(caret, caret);
  }, [value, textareaRef]);

  /* The query settles for a beat before the full model catalog joins the
     pool — everything already listed keeps filtering instantly. All of
     this is the client-side cached catalog; no server round trip. */
  const query = trigger?.query ?? "";
  const [settledQuery, setSettledQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(
      () => setSettledQuery(query),
      query ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(id);
  }, [query]);

  const commands = useMemo(() => {
    if (!trigger) return [];
    const built = buildCommands(context, {
      searching: settledQuery.trim().length > 0,
      thinkingOpen,
      onToggleThinking: () => {
        if (!thinkingOpen) setWantThinkingFocus(true);
        setThinkingOpen(!thinkingOpen);
      },
    });
    return filterCommands(built, trigger.query);
  }, [trigger, context, settledQuery, thinkingOpen]);

  /* The catalog pass is owed for what's being typed — true through the
     whole debounce stretch, so the shimmer sweeps once instead of
     restarting per keystroke. */
  const searchPending = query.trim().length > 0 && settledQuery !== query;

  /* Height morph plumbing, straight from the search modal: observe the
     (max-h capped) body through a callback ref and let the spring chase
     it. Reset when the palette closes so a reopen doesn't spring from the
     previous token's height. */
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    if (!bodyEl) return;
    const observer = new ResizeObserver(() => {
      const next = bodyEl.offsetHeight;
      if (next > 0) setHeight(next);
    });
    observer.observe(bodyEl);
    return () => observer.disconnect();
  }, [bodyEl]);
  const isOpen = trigger !== null;
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    setHeight("auto");
    if (!isOpen && thinkingOpen) setThinkingOpen(false);
  }

  /* Typing again folds the thinking levels away — filtering and nesting
     don't mix. */
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    if (thinkingOpen) setThinkingOpen(false);
  }

  /* New list shape or a new token → highlight back to the top (or, right
     after unfolding thinking, onto the current level). Reset during
     render (the sanctioned derived-state pattern) so there's no flash of
     a stale highlight. */
  const shape = `${trigger?.start ?? -1}:${commands.map((c) => c.id).join(",")}`;
  const [prevShape, setPrevShape] = useState(shape);
  if (prevShape !== shape) {
    setPrevShape(shape);
    let next = 0;
    if (wantThinkingFocus) {
      setWantThinkingFocus(false);
      const levelIndex = commands.findIndex(
        (command) => command.id.startsWith("gate:thinking:") && command.selected,
      );
      const firstLevel = commands.findIndex((command) =>
        command.id.startsWith("gate:thinking:"),
      );
      next = levelIndex >= 0 ? levelIndex : Math.max(firstLevel, 0);
    }
    setActiveIndex(next);
  }

  const close = () => {
    if (trigger) dismissedStart.current = trigger.start;
    setTrigger(null);
  };

  const replaceTrigger = (replacement: string) => {
    if (!trigger) return;
    const before = value.slice(0, trigger.start);
    const after = value.slice(trigger.start + 1 + trigger.query.length);
    onValueChange(before + replacement + after);
    pendingCaret.current = trigger.start + replacement.length;
  };

  const select = (command: Command) => {
    if (command.disabled) return;
    if (command.keepOpen) {
      command.onSelect();
      return;
    }
    command.onSelect();
    replaceTrigger(command.insertText ?? "");
    dismissedStart.current = null;
    setTrigger(null);
  };

  const onKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ): boolean => {
    if (!trigger) return false;
    if (event.nativeEvent.isComposing) return false;
    switch (event.key) {
      case "ArrowDown": {
        if (commands.length === 0) return false;
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % commands.length);
        return true;
      }
      case "ArrowUp": {
        if (commands.length === 0) return false;
        event.preventDefault();
        setActiveIndex(
          (index) => (index - 1 + commands.length) % commands.length,
        );
        return true;
      }
      case "Enter":
      case "Tab": {
        if (commands.length === 0) return false;
        const command = commands[activeIndex];
        if (!command || command.disabled) return false;
        event.preventDefault();
        select(command);
        return true;
      }
      case "Escape": {
        event.preventDefault();
        /* First Escape folds the thinking levels back; the next one
           parks the palette. */
        if (thinkingOpen) setThinkingOpen(false);
        else close();
        return true;
      }
      default:
        return false;
    }
  };

  const element = (
    <AnimatePresence>
      {trigger && (
        <motion.div
          key="command-menu"
          {...POP}
          role="menu"
          aria-label="Composer commands"
          className="raised absolute bottom-full left-0 z-40 mb-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden bg-popover text-popover-foreground ring-1 ring-border dark:ring-white/[0.14]"
        >
          <motion.div
            initial={false}
            animate={{ height }}
            transition={HEIGHT_SPRING}
            className="overflow-hidden"
          >
            <div
              ref={setBodyEl}
              className="max-h-80 overflow-y-auto p-1 [scrollbar-gutter:stable]"
            >
              {commands.length === 0 && !searchPending ? (
                <div className="px-2 py-4 text-center text-[13px] text-muted-foreground">
                  No matches
                </div>
              ) : (
                commands.map((command, index) => (
                  <CommandRow
                    key={command.id}
                    command={command}
                    active={activeIndex === index}
                    onActivate={() => setActiveIndex(index)}
                    onSelect={() => select(command)}
                  />
                ))
              )}
              {/* One persistent notice for the whole catalog-search
                  stretch — restyling between the empty slot and a row
                  under the matches keeps the shimmer sweeping instead of
                  resetting on remount. */}
              {searchPending && (
                <motion.div
                  {...POP_IN}
                  className={
                    commands.length === 0
                      ? "flex h-14 items-center justify-center gap-2.5"
                      : "flex h-9 items-center gap-2.5 px-2"
                  }
                >
                  <IconLoader2
                    size={15}
                    className="shrink-0 animate-spin text-muted-foreground"
                  />
                  <span className="text-shimmer text-[13.5px]/4">
                    Searching models…
                  </span>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return { open: trigger !== null, onKeyDown, element };
}

function CommandRow({
  command,
  active,
  onActivate,
  onSelect,
}: {
  command: Command;
  active: boolean;
  onActivate: () => void;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      disabled={command.disabled}
      title={command.disabled ? command.disabledHint : undefined}
      /* Keep the textarea focused — selection happens without a blur. */
      onPointerDown={(event) => event.preventDefault()}
      onPointerEnter={onActivate}
      onClick={onSelect}
      className={`flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-[13.5px]/5 transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50 ${
        active && !command.disabled
          ? "bg-accent text-accent-foreground"
          : ""
      }`}
    >
      {command.glyph}
      <span className="min-w-0 flex-1 truncate">
        {command.label}
        {command.sub && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {command.sub}
          </span>
        )}
      </span>
      {command.selected && (
        <IconCheck size={14} className="shrink-0 text-muted-foreground" />
      )}
      {command.hint && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {command.hint}
        </span>
      )}
      {command.expandable && (
        <IconChevronDown
          size={13}
          className={`shrink-0 text-muted-foreground transition-transform duration-150 ${
            command.expanded ? "rotate-180" : ""
          }`}
        />
      )}
    </button>
  );
}
