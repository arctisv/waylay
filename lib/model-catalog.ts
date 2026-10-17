import { IMAGE_MODEL } from "@/lib/local/inference/image-engine";
import { LOCAL_MODELS } from "@/lib/local/inference/models";
import { CHAT_MODELS, type ComposerModel } from "@/lib/models";

/* What the picker renders: the fixed lineup, each tier wearing the name
   and maker of the model it downloads (lib/local/inference/models.ts) so
   search and the catalog list can say what actually runs. */
const COMPOSER_MODELS: ComposerModel[] = CHAT_MODELS.map((model) => {
  const local =
    model.key === "Auto"
      ? null
      : model.key === "Image"
        ? IMAGE_MODEL
        : LOCAL_MODELS[model.key];
  return {
    ...model,
    company: local?.company,
    fullName: local ? `${model.name} · ${local.label}` : undefined,
  };
});

export function useComposerModels(): ComposerModel[] {
  return COMPOSER_MODELS;
}
