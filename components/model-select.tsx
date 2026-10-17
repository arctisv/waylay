"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  IconArchive,
  IconArrowLeft,
  IconBrain,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconEyeFilled,
  IconFileFilled,
  IconPhotoFilled,
  IconSearch,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { clampThinking } from "@/lib/composer-gates";
import { useComposerModels } from "@/lib/model-catalog";
import { useModelFavorites } from "@/lib/model-favorites";
import type { SetModelPref } from "@/lib/model-pref";
import { searchModels } from "@/lib/model-search";
import {
  THINKING_LABELS,
  isCustomModelKey,
  type ComposerModel,
  type ThinkingLevel,
} from "@/lib/models";
import { pinRasterPath } from "@/lib/motion";
import { filterModels, ModelFilterMenu } from "./model-filter-menu";
import { ModelGlyph } from "./model-glyph";
import { ScrollFade, useScrollFades } from "./scroll-fade";
import { SteppedSlider } from "./stepped-slider";
import { ToggleSwitch } from "./toggle-switch";

const SMALL_WIDTH = 232;
const BIG_WIDTH = 320;

/* The container's morph between the two views — same hot tuning as the
   composer's reshuffle so the whole surface family snaps alike. */
const MORPH_SPRING = {
  type: "spring",
  stiffness: 900,
  damping: 55,
  mass: 0.5,
} as const;

/* Views slide like navigation: forward (small → big) enters from the
   right, back enters from the left. */
const slideVariants = {
  enter: (direction: number) => ({ x: 28 * direction, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: -28 * direction, opacity: 0 }),
};

const SLIDE_TRANSITION = {
  x: MORPH_SPRING,
  opacity: { duration: 0.15, ease: "linear" },
} as const;

/* Vertical roll for swapped-out text/icons (thinking level, chip model). */
const ROLL = {
  initial: { y: 10, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -10, opacity: 0 },
  transition: { y: MORPH_SPRING, opacity: { duration: 0.12, ease: "linear" } },
  transformTemplate: pinRasterPath,
} as const;

/* Gate icons (search / thinking) grow into the chip and collapse away,
   margin included, so the neighbors glide instead of jumping the gap. */
const GATE = {
  initial: { width: 0, marginLeft: 0, opacity: 0, scale: 0.5 },
  animate: { width: 12, marginLeft: 6, opacity: 1, scale: 1 },
  exit: { width: 0, marginLeft: 0, opacity: 0, scale: 0.5 },
  transition: {
    width: MORPH_SPRING,
    marginLeft: MORPH_SPRING,
    scale: MORPH_SPRING,
    opacity: { duration: 0.12, ease: "linear" },
  },
  transformTemplate: pinRasterPath,
} as const;

const ROW =
  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left text-[13.5px]/5 transition-colors duration-100 hover:bg-accent hover:text-accent-foreground";

function CapabilityIcon({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex cursor-default items-center" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/* The capability strip under a model's name: one pill of tiny marks
   (vision, files, thinking, image output). A model that earns no marks
   gets no pill — an empty one reads as a rendering glitch. */
function ModelTags({ model }: { model: ComposerModel }) {
  const thinks = model.thinkingLevels.some((level) => level !== "none");
  const hasMarks = model.vision || model.files || thinks || model.imageOutput;
  if (!hasMarks) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hasMarks && (
        <span className="flex h-5 items-center gap-1.5 rounded-full bg-black/[0.05] px-2 text-muted-foreground dark:bg-white/[0.06]">
          {model.vision && (
            <CapabilityIcon label="Sees images">
              <IconEyeFilled size={12} />
            </CapabilityIcon>
          )}
          {model.files && (
            <CapabilityIcon label="Reads files">
              <IconFileFilled size={12} />
            </CapabilityIcon>
          )}
          {thinks && (
            <CapabilityIcon label="Can think">
              <IconBrain size={12} stroke={2.5} />
            </CapabilityIcon>
          )}
          {model.imageOutput && (
            <CapabilityIcon label="Makes images">
              <IconPhotoFilled size={12} />
            </CapabilityIcon>
          )}
        </span>
      )}
    </div>
  );
}

/* The composer's model chip. Opens the compact picker — favorited models
   plus the search/thinking gates — which morphs into the full catalog
   (search, capability tags, favorite stars) and back, one surface
   stretching between the two. The chip itself morphs too: the model rolls
   over on change and little gate icons grow in while search/thinking are
   engaged. */
export function ModelSelect({
  value,
  onValueChange,
  searchAvailable = true,
  searchOn,
  onSearchOnChange,
  thinking,
  onThinkingChange,
}: {
  value: string;
  onValueChange: SetModelPref;
  /** False when this deployment has no web search: the switch hides. */
  searchAvailable?: boolean;
  /* The gates live in the composer (one source of truth — the command
     palette flips them too); this picker just wears and edits them. */
  searchOn: boolean;
  onSearchOnChange: (on: boolean) => void;
  thinking: ThinkingLevel;
  onThinkingChange: (level: ThinkingLevel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"small" | "big">("small");
  const [query, setQuery] = useState("");
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const [capabilityFilters, setCapabilityFilters] = useState<
    ReadonlySet<string>
  >(new Set());
  const { favorites, toggleFavorite } = useModelFavorites();
  /* The catalog scroller's dissolving edges — same treatment as the
     sidebar's thread list, fading from the popover surface. */
  const { scrollRef, onScroll, fades } = useScrollFades();
  /* Every model the picker offers. models[0] is Auto — the fallback when
     a saved pick no longer exists. */
  const models = useComposerModels();
  const current = models.find((model) => model.key === value) ?? models[0];

  /* Keep the thinking level on the current model's wheel — Heavy has no
     "none", Image has nothing else. Shared with the send path
     (lib/composer-gates.ts), so the chip never shows a state the request
     wouldn't carry. */
  const levels = current.thinkingLevels;
  const level = clampThinking(current, thinking);
  /* Auto runs the gates itself — both rows blank out and the chip shows no
     gate icons. The user's choices survive underneath for when they switch
     back to a hands-on model. */
  const gatesLocked = current.autoGates;
  const searchShown = searchOn && !gatesLocked;
  const thinkingOn = level !== "none" && !gatesLocked;
  const thinkingLabel = gatesLocked
    ? current.key === "Auto"
      ? "Auto"
      : "None"
    : THINKING_LABELS[level];

  /* Chip width chases an invisible twin that always wears the final
     content, so the pill stretches on the same spring the label rolls
     on. */
  const twinRef = useRef<HTMLSpanElement>(null);
  const [chipWidth, setChipWidth] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    if (twinRef.current) setChipWidth(twinRef.current.offsetWidth);
  }, [value, current.name, searchShown, thinkingOn]);

  /* The popover's height morph: measure whichever view is live (popLayout
     pops the exiting one out of flow) and let the spring chase it. */
  const [measureEl, setMeasureEl] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    if (!measureEl) return;
    const observer = new ResizeObserver(() => setHeight(measureEl.offsetHeight));
    observer.observe(measureEl);
    return () => observer.disconnect();
  }, [measureEl]);

  const direction = view === "big" ? 1 : -1;
  const targetWidth = view === "big" ? BIG_WIDTH : SMALL_WIDTH;

  const visibleModels = models;

  /* The compact picker holds the starred models. An empty favorites list
     would leave a pointless picker — fall back to the preset lineup. */
  const favoriteModels = visibleModels.filter((model) =>
    favorites.has(model.key),
  );
  const compactModels =
    favoriteModels.length > 0
      ? favoriteModels
      : visibleModels.filter((model) => !isCustomModelKey(model.key));

  /* Browsing folds legacy models behind a count row at the foot of the
     list; a typed query searches everything, legacy included (sorted
     below the current lineup by the catalog). */
  const trimmed = query.trim();
  const filtered = filterModels(visibleModels, providerFilter, capabilityFilters);
  const catalog = trimmed
    ? searchModels(filtered, trimmed)
    : filtered.filter((model) => !model.legacy);
  const legacyModels = trimmed
    ? []
    : filtered.filter((model) => model.legacy);

  /* Deliberately keeps the popover open — picking a model is often step
     one of also setting the gates or stars; dismissal is a click-away. */
  const selectModel = (key: string) => onValueChange(key);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setView("small");
          setQuery("");
          setLegacyOpen(false);
          setProviderFilter(null);
          setCapabilityFilters(new Set());
          setHeight("auto");
        }
      }}
    >
      <PopoverTrigger
        aria-label="Choose model"
        className="relative flex h-9 shrink-0 cursor-pointer items-center rounded-full px-3 text-[13.5px]/4 font-medium text-muted-foreground transition-colors duration-150 hover:bg-black/[0.05] hover:text-foreground data-popup-open:bg-black/[0.05] data-popup-open:text-foreground dark:hover:bg-white/[0.06] dark:data-popup-open:bg-white/[0.06]"
      >
        {/* The width twin: identical content at rest pose, never visible. */}
        <span
          ref={twinRef}
          aria-hidden
          className="invisible absolute top-0 left-3 flex items-center whitespace-nowrap"
        >
          <span className="flex items-center gap-1.5">
            <ModelGlyph model={current} size={15} className="shrink-0" />
            {current.name}
          </span>
          {searchShown && <IconSearch size={12} className="ml-1.5" />}
          {thinkingOn && <IconBrain size={12} className="ml-1.5" />}
        </span>
        <motion.span
          initial={false}
          animate={{ width: chipWidth }}
          transition={MORPH_SPRING}
          className="flex items-center overflow-hidden"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={value}
              {...ROLL}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap"
            >
              <ModelGlyph model={current} size={15} className="shrink-0" />
              {current.name}
            </motion.span>
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {searchShown && (
              <motion.span
                key="search"
                {...GATE}
                className="flex shrink-0 items-center overflow-hidden"
              >
                <IconSearch size={12} stroke={2.5} className="shrink-0" />
              </motion.span>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {thinkingOn && (
              <motion.span
                key="thinking"
                {...GATE}
                className="flex shrink-0 items-center overflow-hidden"
              >
                <IconBrain size={12} stroke={2.5} className="shrink-0" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.span>
      </PopoverTrigger>
      {/* Solid like the user menu — the capability pills and tags get
          muddy over any see-through at all. */}
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-auto min-w-0 p-0"
      >
        <motion.div
          initial={false}
          animate={{ width: targetWidth, height }}
          transition={MORPH_SPRING}
          className="overflow-hidden"
        >
          <div ref={setMeasureEl} style={{ width: targetWidth }}>
            <AnimatePresence mode="popLayout" custom={direction} initial={false}>
              <motion.div
                key={view}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={SLIDE_TRANSITION}
              >
                {view === "small" ? (
                  <div className="p-1">
                    <button
                      type="button"
                      className={ROW}
                      onClick={() => setView("big")}
                    >
                      <IconSearch size={15} className="shrink-0 text-muted-foreground" />
                      Search models
                      <IconChevronRight
                        size={13}
                        className="ml-auto shrink-0 text-muted-foreground"
                      />
                    </button>
                    <div className="my-1 h-px bg-border" />
                    {compactModels.map((model) => (
                      <button
                        key={model.key}
                        type="button"
                        className={ROW}
                        onClick={() => selectModel(model.key)}
                      >
                        <ModelGlyph
                          model={model}
                          size={15}
                          className="shrink-0 text-muted-foreground"
                        />
                        {model.name}
                        {value === model.key && (
                          <IconCheck
                            size={14}
                            className="ml-auto shrink-0 text-muted-foreground"
                          />
                        )}
                      </button>
                    ))}
                    <div className="my-1 h-px bg-border" />
                    {/* The whole row is the switch. */}
                    {searchAvailable && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={searchShown}
                        disabled={gatesLocked}
                        onClick={() => onSearchOnChange(!searchOn)}
                        className={`${ROW} justify-between disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent`}
                      >
                        Search
                        <ToggleSwitch checked={searchShown} />
                      </button>
                    )}
                    {/* The thinking wheel as a slider — each stop is one of
                        the model's levels. Locked and single-level models
                        keep the plain label instead of a dead track. */}
                    <div
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-[13.5px]/5 ${
                        gatesLocked || levels.length < 2
                          ? "opacity-50"
                          : ""
                      }`}
                    >
                      Thinking
                      <span className="flex items-center gap-1.5">
                        {/* Fixed-width slot so the roll never shifts the row. */}
                        <span className="relative h-4 w-14 overflow-hidden text-right text-xs text-muted-foreground">
                          <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span key={thinkingLabel} {...ROLL} className="block">
                              {thinkingLabel}
                            </motion.span>
                          </AnimatePresence>
                        </span>
                        {!gatesLocked && levels.length > 1 && (
                          <SteppedSlider
                            index={levels.indexOf(level)}
                            count={levels.length}
                            onIndexChange={(next) => onThinkingChange(levels[next])}
                            aria-label="Thinking level"
                            getValueText={(next) => THINKING_LABELS[levels[next]]}
                          />
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => setView("small")}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[13.5px]/4 font-medium text-muted-foreground transition-colors duration-100 hover:text-foreground"
                    >
                      <IconArrowLeft size={14} className="shrink-0" />
                      Back
                    </button>
                    <div className="mt-1.5 mb-1 flex items-center gap-1.5">
                      <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full bg-well px-3 shadow-[inset_0_0_0_1px_var(--well-outline),inset_0_1px_0_0_var(--well-highlight)]">
                        <IconSearch
                          size={15}
                          className="shrink-0 text-muted-foreground"
                        />
                        <input
                          autoFocus
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Search models"
                          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                      </div>
                      <ModelFilterMenu
                        models={visibleModels}
                        provider={providerFilter}
                        onProviderChange={setProviderFilter}
                        capabilities={capabilityFilters}
                        onCapabilitiesChange={setCapabilityFilters}
                      />
                    </div>
                    {/* Fixed-height list region: filtering swaps rows inside
                        it without the popover breathing. The dissolving
                        edges say "more this way" — the rows get one wrapper
                        child so the fade hook can watch the content grow
                        and shrink. */}
                    <div className="relative">
                    <div
                      ref={scrollRef}
                      onScroll={onScroll}
                      className="h-56 overflow-y-auto [scrollbar-gutter:stable]"
                    >
                    <div className="flex min-h-full flex-col">
                    {catalog.length === 0 && legacyModels.length === 0 && (
                      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                        {trimmed ? (
                          <>No models match &quot;{query.trim()}&quot;</>
                        ) : (
                          "No models wear all those filters"
                        )}
                      </div>
                    )}
                    {catalog.map((model) => (
                      <CatalogRow
                        key={model.key}
                        model={model}
                        selected={value === model.key}
                        favorite={favorites.has(model.key)}
                        onSelect={() => selectModel(model.key)}
                        onToggleFavorite={() => toggleFavorite(model.key)}
                      />
                    ))}
                    {/* The legacy shelf: retired models fold behind a count
                        row until asked for. A typed search skips the shelf
                        and just finds them. */}
                    {legacyModels.length > 0 && (
                      <>
                        <button
                          type="button"
                          aria-expanded={legacyOpen}
                          onClick={() => setLegacyOpen((prev) => !prev)}
                          className={`${ROW} mt-0.5 py-1.5 text-muted-foreground`}
                        >
                          <IconArchive size={15} className="shrink-0" />
                          {legacyModels.length} legacy{" "}
                          {legacyModels.length === 1 ? "model" : "models"}
                          <IconChevronDown
                            size={14}
                            className={`ml-auto shrink-0 transition-[rotate] duration-150 ${
                              legacyOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {legacyOpen &&
                          legacyModels.map((model) => (
                            <CatalogRow
                              key={model.key}
                              model={model}
                              selected={value === model.key}
                              favorite={favorites.has(model.key)}
                              onSelect={() => selectModel(model.key)}
                              onToggleFavorite={() => toggleFavorite(model.key)}
                            />
                          ))}
                      </>
                    )}
                    </div>
                    </div>
                    <ScrollFade side="top" visible={fades.top} from="from-popover" />
                    <ScrollFade
                      side="bottom"
                      visible={fades.bottom}
                      from="from-popover"
                    />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}

/* One catalog list row: the model button plus the favorite star. Shared
   by the main list and the legacy shelf. */
function CatalogRow({
  model,
  selected,
  favorite,
  onSelect,
  onToggleFavorite,
}: {
  model: ComposerModel;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="group/model relative">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full cursor-pointer flex-col gap-1 rounded-lg px-2 py-1.5 pr-10 text-left transition-colors duration-100 hover:bg-accent"
      >
        <span className="flex items-center gap-2 text-[13.5px]/5 font-medium">
          <ModelGlyph
            model={model}
            size={15}
            className="shrink-0 text-muted-foreground"
          />
          <span className="truncate">{model.fullName ?? model.name}</span>
          {selected && (
            <IconCheck size={14} className="shrink-0 text-muted-foreground" />
          )}
        </span>
        <ModelTags model={model} />
      </button>
      <button
        type="button"
        aria-label={
          favorite
            ? `Unpin ${model.name} from the quick picker`
            : `Pin ${model.name} to the quick picker`
        }
        aria-pressed={favorite}
        onClick={onToggleFavorite}
        className="absolute top-1.5 right-1.5 flex size-6 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,scale] duration-150 hover:bg-black/[0.05] hover:text-foreground active:scale-90 dark:hover:bg-white/[0.06]"
      >
        {favorite ? <IconStarFilled size={14} /> : <IconStar size={14} />}
      </button>
    </div>
  );
}
