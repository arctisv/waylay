"use client";

import { useState } from "react";

import { filterModels, ModelFilterMenu } from "@/components/model-filter-menu";
import { ModelGlyph } from "@/components/model-glyph";
import { useComposerModels } from "@/lib/model-catalog";
import { useModelFavorites } from "@/lib/model-favorites";
import { searchModels } from "@/lib/model-search";
import { modelDetails, type ComposerModel } from "@/lib/models";
import { ToggleSwitch } from "../toggle-switch";
import {
  SettingsCard,
  SettingsHeader,
  SettingsRow,
  SettingsSearchRow,
} from "./settings-rows";

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
      title={model.name}
      description={modelDetails(model)}
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
