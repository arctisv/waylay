"use client";

import { IconFilter, IconFilterFilled } from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MakerLogo } from "@/components/icons/maker-logos";
import type { Maker } from "@/lib/local/inference/models";
import type { ComposerModel } from "@/lib/models";

/* The model filter, shared by the composer's picker and the Models
   settings page: a round button opening a context menu — a Provider
   submenu (radio pick, each maker wearing its model glyph) and stacking
   capability checkboxes. The button wears primary ink while anything is
   engaged. */

/** Which provider a model files under: its maker. */
export function providerOf(model: ComposerModel): Maker | undefined {
  return model.maker;
}

/** The capability filters — each active one keeps only models that clear
 *  its test; several stack (AND). */
export const CAPABILITY_FILTERS = [
  {
    key: "thinking",
    label: "Thinking",
    test: (m: ComposerModel) =>
      m.thinkingLevels.some((level) => level !== "none"),
  },
  { key: "code", label: "Coding", test: (m: ComposerModel) => m.code },
  {
    key: "small",
    label: "Under 1 GB",
    test: (m: ComposerModel) => m.downloadMB !== undefined && m.downloadMB < 1000,
  },
] as const;

/** Keep only the models clearing the active provider + capability filters. */
export function filterModels(
  models: ComposerModel[],
  provider: string | null,
  capabilities: ReadonlySet<string>,
): ComposerModel[] {
  return models.filter(
    (model) =>
      (provider === null || providerOf(model) === provider) &&
      CAPABILITY_FILTERS.every(
        (filter) => !capabilities.has(filter.key) || filter.test(model),
      ),
  );
}

export function ModelFilterMenu({
  models,
  provider,
  onProviderChange,
  capabilities,
  onCapabilitiesChange,
}: {
  /** The lineup to derive the provider list from (pre-filter). */
  models: ComposerModel[];
  provider: string | null;
  onProviderChange: (provider: string | null) => void;
  capabilities: ReadonlySet<string>;
  onCapabilitiesChange: (capabilities: ReadonlySet<string>) => void;
}) {
  /* The makers, alphabetically. */
  const providers = [
    ...new Set(
      models.map(providerOf).filter((name): name is Maker => Boolean(name)),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const active = provider !== null || capabilities.size > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Filter models"
        className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 ${
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-black/[0.05] hover:text-foreground data-popup-open:bg-black/[0.05] data-popup-open:text-foreground dark:hover:bg-white/[0.06] dark:data-popup-open:bg-white/[0.06]"
        }`}
      >
        {active ? <IconFilterFilled size={15} /> : <IconFilter size={15} />}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        className="w-48"
      >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Provider
            {provider && (
              <span className="ml-auto max-w-24 truncate pl-2 text-xs text-muted-foreground">
                {provider}
              </span>
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuRadioGroup
              value={provider ?? ""}
              onValueChange={(value) =>
                onProviderChange(value === "" ? null : String(value))
              }
            >
              <DropdownMenuRadioItem value="">
                All providers
              </DropdownMenuRadioItem>
              {providers.map((name) => (
                <DropdownMenuRadioItem key={name} value={name}>
                  <MakerLogo maker={name} size={14} className="shrink-0 text-muted-foreground" />
                  <span className="truncate">{name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {CAPABILITY_FILTERS.map((filter) => (
          <DropdownMenuCheckboxItem
            key={filter.key}
            checked={capabilities.has(filter.key)}
            closeOnClick={false}
            onCheckedChange={(checked) => {
              const next = new Set(capabilities);
              if (checked) next.add(filter.key);
              else next.delete(filter.key);
              onCapabilitiesChange(next);
            }}
          >
            {filter.label}
          </DropdownMenuCheckboxItem>
        ))}
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onProviderChange(null);
                onCapabilitiesChange(new Set());
              }}
            >
              Clear filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
