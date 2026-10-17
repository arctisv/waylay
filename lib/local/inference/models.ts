import type { ChatModelKey } from "@/lib/models";
import type { SupportReport } from "../device/types";

/* The models Waylay can run, by the picker's keys. Each GPU model comes in
   two WebLLM builds with the same weights: f16 is smaller and faster but
   needs a GPU with 16-bit shader support; f32 runs everywhere else. Without
   a usable GPU, every key runs one small model on the processor instead. */

export type PromptFamily = "llama" | "qwen";

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
  family: PromptFamily;
};

export type TextModelKey = Exclude<ChatModelKey, "Auto" | "Image">;

export const LOCAL_MODELS: Record<TextModelKey, LocalModel> = {
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

/** The processor model: small enough to answer at a readable pace on a
 *  laptop CPU, through Transformers.js — and it can think, too. */
export const CPU_MODEL = {
  label: "Qwen 3 0.6B",
  company: "Alibaba",
  repo: "onnx-community/Qwen3-0.6B-ONNX",
  /** 8-bit weights: the fastest variant on WebAssembly. */
  dtype: "q8",
  downloadMB: 620,
  family: "qwen" as const,
};

/** Auto runs the light model: quick to download and fast on most devices. */
export const AUTO_MODEL: TextModelKey = "Fast";

export function localModelFor(key: string | undefined): LocalModel {
  if (key && key in LOCAL_MODELS) return LOCAL_MODELS[key as TextModelKey];
  return LOCAL_MODELS[AUTO_MODEL];
}

/** What actually runs a text turn on this device. */
export type Runtime =
  | {
      backend: "webgpu";
      /** The WebLLM model id. */
      id: string;
      label: string;
      downloadMB: number;
      reasoning: boolean;
      family: PromptFamily;
    }
  | {
      backend: "cpu";
      /** The Hugging Face repo. */
      id: string;
      dtype: string;
      label: string;
      downloadMB: number;
      reasoning: boolean;
      family: PromptFamily;
    };

export function runtimeFor(key: string | undefined, support: SupportReport): Runtime {
  if (support.backend === "cpu") {
    return {
      backend: "cpu",
      id: CPU_MODEL.repo,
      dtype: CPU_MODEL.dtype,
      label: CPU_MODEL.label,
      downloadMB: CPU_MODEL.downloadMB,
      reasoning: true,
      family: CPU_MODEL.family,
    };
  }
  const model = localModelFor(key);
  return {
    backend: "webgpu",
    id: support.specs.shaderF16 ? model.builds.f16 : model.builds.f32,
    label: model.label,
    downloadMB: model.downloadMB,
    reasoning: model.reasoning,
    family: model.family,
  };
}
