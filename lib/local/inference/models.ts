import type { ChatModelKey } from "@/lib/models";

/* The models Waylay can run, by the picker's keys. Each comes in two builds
   with the same weights: f16 is smaller and faster but needs a GPU with
   16-bit shader support; f32 runs everywhere else. */

export type LocalModel = {
  /** What the model is called in settings. */
  label: string;
  company: string;
  builds: { f16: string; f32: string };
  /** Download size, rounded, for the progress line and settings. */
  downloadMB: number;
  /** Writes its reasoning first (inside <think> tags) when asked to. */
  reasoning: boolean;
  /** Prompt format family, which decides how tools are described and called. */
  family: "llama" | "qwen";
};

export const LOCAL_MODELS: Record<Exclude<ChatModelKey, "Auto">, LocalModel> = {
  Fast: {
    label: "Llama 3.2 1B",
    company: "Meta",
    builds: {
      f16: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      f32: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    },
    downloadMB: 660,
    reasoning: false,
    family: "llama",
  },
  Think: {
    label: "Qwen 3 1.7B",
    company: "Alibaba",
    builds: {
      f16: "Qwen3-1.7B-q4f16_1-MLC",
      f32: "Qwen3-1.7B-q4f32_1-MLC",
    },
    downloadMB: 920,
    reasoning: true,
    family: "qwen",
  },
  Max: {
    label: "Llama 3.2 3B",
    company: "Meta",
    builds: {
      f16: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
      f32: "Llama-3.2-3B-Instruct-q4f32_1-MLC",
    },
    downloadMB: 1720,
    reasoning: false,
    family: "llama",
  },
};

/** Auto runs the light model: quick to download and fast on most devices. */
export const AUTO_MODEL: Exclude<ChatModelKey, "Auto"> = "Fast";

export function localModelFor(key: string | undefined): LocalModel {
  if (key && key in LOCAL_MODELS) return LOCAL_MODELS[key as keyof typeof LOCAL_MODELS];
  return LOCAL_MODELS[AUTO_MODEL];
}

/** The WebLLM build to load for a picker key on this GPU. */
export function buildFor(model: LocalModel, shaderF16: boolean): string {
  return shaderF16 ? model.builds.f16 : model.builds.f32;
}
