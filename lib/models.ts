import {
  findModel,
  LOCAL_MODELS,
  type LocalModel,
  type Maker,
} from "@/lib/local/inference/models";

/* The composer picker's lineup: Auto, then every model in the on-device
   catalog (lib/local/inference/models.ts), by name. A chat saves the key,
   so catalog keys never change. */

export type ThinkingLevel = "none" | "low" | "medium" | "high";

export const THINKING_LABELS: Record<ThinkingLevel, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export type ComposerModel = {
  key: string;
  name: string;
  /** Who made it. Absent on Auto. */
  maker?: Maker;
  /** One line on what it's good for. */
  blurb: string;
  /** What model search matches besides the name. Lowercase. */
  aliases: string[];
  /** What the thinking wheel cycles through — never empty. Models that
   *  can't think carry ["none"]; ones that always do carry ["high"]. */
  thinkingLevels: ThinkingLevel[];
  /** Auto runs the thinking gate itself, so the picker blanks it out. */
  autoGates: boolean;
  /** Tuned for code. */
  code: boolean;
  /** Starts out pinned to the compact picker. */
  featured: boolean;
  /** The download for this device's build. Absent on Auto. */
  downloadMB?: number;
};

export const AUTO_MODEL: ComposerModel = {
  key: "Auto",
  name: "Auto",
  blurb: "Picks a quick model for this device",
  aliases: ["auto", "default", "picks for you"],
  thinkingLevels: ["none"],
  autoGates: true,
  code: false,
  featured: true,
};

function thinkingLevels(model: LocalModel): ThinkingLevel[] {
  if (model.thinking === "always") return ["high"];
  if (model.thinking === "optional") return ["none", "high"];
  return ["none"];
}

function composerModel(model: LocalModel): ComposerModel {
  const thinks = model.thinking !== "never";
  return {
    key: model.key,
    name: model.name,
    maker: model.maker,
    blurb: model.blurb,
    aliases: [
      model.key,
      model.maker.toLowerCase(),
      ...(thinks ? ["thinking", "reasoning"] : []),
      ...(model.code ? ["code", "coding", "coder"] : []),
    ],
    thinkingLevels: thinkingLevels(model),
    autoGates: false,
    code: Boolean(model.code),
    featured: Boolean(model.featured),
  };
}

/** Every model, Auto first — whichever device it's on. */
export const CHAT_MODELS: ComposerModel[] = [
  AUTO_MODEL,
  ...LOCAL_MODELS.map(composerModel),
];

/* Where a composer starts, and where a never-chosen preference lands:
   Auto picks the model so nobody has to (lib/model-pref.ts). */
export const DEFAULT_MODEL_KEY = "Auto";

/** "700 MB", "1.8 GB" — a download, the way the picker says it. */
export function formatDownload(megabytes: number): string {
  return megabytes >= 1000 ? `${(megabytes / 1000).toFixed(1)} GB` : `${megabytes} MB`;
}

/** The picker's and settings' line under a model's name. */
export function modelDetails(model: ComposerModel): string {
  return model.downloadMB
    ? `${model.blurb} · ${formatDownload(model.downloadMB)}`
    : model.blurb;
}

/** The lineup key a saved key stands for — older chats' tier keys
 *  included — or Auto when it's no longer in the lineup. */
export function lineupKey(key: string | null | undefined): string {
  return findModel(key)?.key ?? DEFAULT_MODEL_KEY;
}

export function lineupModel(key: string | null | undefined): ComposerModel {
  const lineup = lineupKey(key);
  return CHAT_MODELS.find((model) => model.key === lineup) ?? AUTO_MODEL;
}
