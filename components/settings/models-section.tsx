"use client";

import { useState } from "react";

import { filterModels, ModelFilterMenu } from "@/components/model-filter-menu";
import { ModelGlyph } from "@/components/model-glyph";
import { useComposerModels } from "@/lib/model-catalog";
import { useModelFavorites } from "@/lib/model-favorites";
import { searchModels } from "@/lib/model-search";
import type { ComposerModel } from "@/lib/models";
import { ToggleSwitch } from "../toggle-switch";
import {
  SettingsCard,
  SettingsHeader,
  SettingsRow,
  SettingsSearchRow,
} from "./settings-rows";

function capabilityBlurb(model: ComposerModel): string {
  const bits = [
    model.imageOutput ? "paints pictures" : null,
    model.vision ? "sees images" : null,
    model.files ? "reads files" : null,
    model.thinkingLevels.some((level) => level !== "none")
      ? "can think hard"
      : null,
  ].filter((bit): bit is string => bit !== null);

  const blurb = bits.join(" · ");
  return blurb.charAt(0).toUpperCase() + blurb.slice(1);
}

export function ModelsSection() {
  const models = useComposerModels();
  const { favorites, toggleFavorite } = useModelFavorites();
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const needle = query.trim();
  const filtered = filterModels(models, provider, capabilities);
  const shownModels = needle ? searchModels(filtered, needle) : filtered;

  const modelRow = (model: ComposerModel) => (
    <SettingsRow
      key={model.key}
      iconNode={<ModelGlyph model={model} size={18} />}
      title={model.fullName ?? model.name}
      description={capabilityBlurb(model)}
      control={
        <ToggleSwitch
          checked={favorites.has(model.key)}
          onCheckedChange={() => toggleFavorite(model.key)}
          aria-label={`Show ${model.name} in the quick picker`}
        />
      }
    />
  );

  return (
    <>
      <SettingsHeader
        title="Models"
        description="Choose which models show up in the composer's quick picker."
      />
      <SettingsCard>
        <SettingsSearchRow
          value={query}
          onChange={setQuery}
          placeholder="Search models…"
          trailing={
            <ModelFilterMenu
              models={models}
              provider={provider}
              onProviderChange={setProvider}
              capabilities={capabilities}
              onCapabilitiesChange={setCapabilities}
            />
          }
        />
        {shownModels.map(modelRow)}
        {shownModels.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            {needle
              ? `No models match “${query.trim()}”.`
              : "No models wear all those filters."}
          </p>
        )}
      </SettingsCard>
    </>
  );
}
