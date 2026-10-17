import {
  IconBarbellFilled,
  IconBoltFilled,
  IconPhotoFilled,
  IconSparklesFilled,
  type Icon,
} from "@tabler/icons-react";

import { IconBrainFilled } from "@/components/icons/brain-filled";

/* The model lineup for the composer's picker. Every one runs on this
   device (lib/local/inference/models.ts maps each key to its download);
   the keys are what gets saved with a chat, so never rename them. */

export type ChatModelKey = "Auto" | "Fast" | "Think" | "Max" | "Image";

export type ThinkingLevel = "none" | "low" | "medium" | "high";

export const THINKING_LABELS: Record<ThinkingLevel, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export type ChatModel = {
  key: ChatModelKey;
  name: string;
  icon: Icon;
  /** What model search matches besides the name — underlying model names,
   *  providers, nicknames. Lowercase. */
  aliases: string[];
  /** Accepts image input. */
  vision: boolean;
  /** Accepts document/file input natively. */
  files: boolean;
  /** Paints pictures instead of paragraphs. */
  imageOutput: boolean;
  /** What the thinking rotator cycles through — never empty. Models that
   *  can't think just carry ["none"]; Heavy always reasons, so "none"
   *  isn't on its wheel at all. */
  thinkingLevels: ThinkingLevel[];
  /** The model runs the search/thinking gates itself (Auto decides,
   *  Image has neither) — the picker blanks them out. */
  autoGates: boolean;
};

export const CHAT_MODELS: ChatModel[] = [
  {
    key: "Auto",
    name: "Auto",
    icon: IconSparklesFilled,
    aliases: ["auto", "picks for you", "llama", "default"],
    vision: false,
    files: false,
    imageOutput: false,
    thinkingLevels: ["none"],
    autoGates: true,
  },
  {
    key: "Fast",
    name: "Fast",
    icon: IconBoltFilled,
    aliases: ["fast", "llama", "llama 3.2", "llama 3.2 1b", "meta", "light"],
    vision: false,
    files: false,
    imageOutput: false,
    thinkingLevels: ["none"],
    autoGates: false,
  },
  {
    key: "Think",
    name: "Thinking",
    icon: IconBrainFilled,
    aliases: ["thinking", "reasoning", "qwen", "qwen 3", "qwen3 1.7b", "alibaba"],
    vision: false,
    files: false,
    imageOutput: false,
    /* Qwen 3 thinks or it doesn't — there are no levels in between. */
    thinkingLevels: ["none", "high"],
    autoGates: false,
  },
  {
    key: "Max",
    name: "Heavy",
    icon: IconBarbellFilled,
    aliases: ["heavy", "llama", "llama 3.2 3b", "meta", "smartest", "max"],
    vision: false,
    files: false,
    imageOutput: false,
    thinkingLevels: ["none"],
    autoGates: false,
  },
  {
    key: "Image",
    name: "Image",
    icon: IconPhotoFilled,
    aliases: ["image", "picture", "paint", "draw", "janus", "janus pro", "deepseek"],
    vision: false,
    files: false,
    imageOutput: true,
    thinkingLevels: ["none"],
    autoGates: false,
  },
];

/* Where a composer starts, and where a never-chosen preference lands:
   Auto picks the model so nobody has to (lib/model-pref.ts). */
export const DEFAULT_MODEL_KEY: ChatModelKey = "Auto";

/* What the picker actually renders: the static lineup above, each tier
   wearing the maker and full name of the model it runs
   (lib/model-catalog.ts). */
export type ComposerModel = ChatModel & {
  /** Who made the model it runs ("Meta"). Absent on Auto. */
  company?: string;
  /** The tier with the model it runs ("Fast · Llama 3.2 1B") — what the
   *  catalog list shows. Absent on Auto, which goes by `name`. */
  fullName?: string;
};
