import type { SupportReport } from "../device/types";

/* Every model Waylay can run, by the key a chat saves. A model runs on the
   GPU through WebLLM, on the processor through Transformers.js, or either:
   the device decides which build a turn loads (runtimeFor below), and the
   picker only lists what this device can run.

   GPU builds come in two flavours with the same weights: f16 is smaller and
   faster but needs 16-bit shader support; f32 runs everywhere else. Sizes
   are the download, rounded, for the progress line, picker and settings. */

/** How a model calls tools: Llama's bracketed calls, Qwen's <tool_call>
 *  JSON, or not at all (it just answers). */
export type ToolStyle = "llama" | "qwen" | null;

/** Whether a model reasons in <think> tags first: never, when asked, or
 *  every time. */
export type ThinkingSupport = "never" | "optional" | "always";

export type Maker =
  | "Meta"
  | "Qwen"
  | "DeepSeek"
  | "Google"
  | "Microsoft"
  | "Mistral"
  | "Hugging Face"
  | "Liquid AI";

export type GpuBuild = { f16: string; f32?: string; downloadMB: number };
export type CpuBuild = { repo: string; dtype: string; downloadMB: number };

export type LocalModel = {
  key: string;
  name: string;
  maker: Maker;
  /** One line on what it's good for, for the picker. */
  blurb: string;
  thinking: ThinkingSupport;
  tools: ToolStyle;
  /** Tuned for code. */
  code?: boolean;
  /** Starts out pinned to the compact picker. */
  featured?: boolean;
  gpu?: GpuBuild;
  cpu?: CpuBuild;
};

export const LOCAL_MODELS: LocalModel[] = [
  {
    key: "llama-3.2-1b",
    name: "Llama 3.2 1B",
    maker: "Meta",
    blurb: "Quick everyday answers",
    thinking: "never",
    tools: "llama",
    featured: true,
    gpu: { f16: "Llama-3.2-1B-Instruct-q4f16_1-MLC", f32: "Llama-3.2-1B-Instruct-q4f32_1-MLC", downloadMB: 700 },
    cpu: { repo: "onnx-community/Llama-3.2-1B-Instruct-ONNX", dtype: "q8", downloadMB: 1240 },
  },
  {
    key: "llama-3.2-3b",
    name: "Llama 3.2 3B",
    maker: "Meta",
    blurb: "Sharper writing, still quick",
    thinking: "never",
    tools: "llama",
    featured: true,
    gpu: { f16: "Llama-3.2-3B-Instruct-q4f16_1-MLC", f32: "Llama-3.2-3B-Instruct-q4f32_1-MLC", downloadMB: 1810 },
  },
  {
    key: "llama-3.1-8b",
    name: "Llama 3.1 8B",
    maker: "Meta",
    blurb: "Meta's strongest that fits a laptop",
    thinking: "never",
    tools: "llama",
    gpu: { f16: "Llama-3.1-8B-Instruct-q4f16_1-MLC", f32: "Llama-3.1-8B-Instruct-q4f32_1-MLC", downloadMB: 4520 },
  },
  {
    key: "qwen3-0.6b",
    name: "Qwen 3 0.6B",
    maker: "Qwen",
    blurb: "Tiny, and it can think",
    thinking: "optional",
    tools: "qwen",
    gpu: { f16: "Qwen3-0.6B-q4f16_1-MLC", f32: "Qwen3-0.6B-q4f32_1-MLC", downloadMB: 340 },
    cpu: { repo: "onnx-community/Qwen3-0.6B-ONNX", dtype: "q8", downloadMB: 620 },
  },
  {
    key: "qwen3-1.7b",
    name: "Qwen 3 1.7B",
    maker: "Qwen",
    blurb: "Small and quick, reasons when asked",
    thinking: "optional",
    tools: "qwen",
    featured: true,
    gpu: { f16: "Qwen3-1.7B-q4f16_1-MLC", f32: "Qwen3-1.7B-q4f32_1-MLC", downloadMB: 970 },
  },
  {
    key: "qwen3-4b",
    name: "Qwen 3 4B",
    maker: "Qwen",
    blurb: "Strong reasoning for its size",
    thinking: "optional",
    tools: "qwen",
    featured: true,
    gpu: { f16: "Qwen3-4B-q4f16_1-MLC", f32: "Qwen3-4B-q4f32_1-MLC", downloadMB: 2260 },
  },
  {
    key: "qwen3-8b",
    name: "Qwen 3 8B",
    maker: "Qwen",
    blurb: "The deepest thinker here",
    thinking: "optional",
    tools: "qwen",
    gpu: { f16: "Qwen3-8B-q4f16_1-MLC", f32: "Qwen3-8B-q4f32_1-MLC", downloadMB: 4610 },
  },
  {
    key: "qwen3.5-0.8b",
    name: "Qwen 3.5 0.8B",
    maker: "Qwen",
    blurb: "Newest Qwen, pocket sized",
    thinking: "optional",
    tools: "qwen",
    gpu: { f16: "Qwen3.5-0.8B-q4f16_1-MLC", f32: "Qwen3.5-0.8B-q4f32_1-MLC", downloadMB: 450 },
  },
  {
    key: "qwen3.5-2b",
    name: "Qwen 3.5 2B",
    maker: "Qwen",
    blurb: "Newest Qwen, light and capable",
    thinking: "optional",
    tools: "qwen",
    gpu: { f16: "Qwen3.5-2B-q4f16_1-MLC", f32: "Qwen3.5-2B-q4f32_1-MLC", downloadMB: 1080 },
  },
  {
    key: "qwen3.5-4b",
    name: "Qwen 3.5 4B",
    maker: "Qwen",
    blurb: "Newest Qwen, balanced",
    thinking: "optional",
    tools: "qwen",
    gpu: { f16: "Qwen3.5-4B-q4f16_1-MLC", f32: "Qwen3.5-4B-q4f32_1-MLC", downloadMB: 2390 },
  },
  {
    key: "qwen3.5-9b",
    name: "Qwen 3.5 9B",
    maker: "Qwen",
    blurb: "Newest Qwen, the big one",
    thinking: "optional",
    tools: "qwen",
    gpu: { f16: "Qwen3.5-9B-q4f16_1-MLC", f32: "Qwen3.5-9B-q4f32_1-MLC", downloadMB: 5060 },
  },
  {
    key: "qwen2.5-0.5b",
    name: "Qwen 2.5 0.5B",
    maker: "Qwen",
    blurb: "Small and steady",
    thinking: "never",
    tools: "qwen",
    cpu: { repo: "onnx-community/Qwen2.5-0.5B-Instruct", dtype: "q8", downloadMB: 510 },
  },
  {
    key: "qwen2.5-coder-1.5b",
    name: "Qwen 2.5 Coder 1.5B",
    maker: "Qwen",
    blurb: "Code help that loads fast",
    thinking: "never",
    tools: "qwen",
    code: true,
    gpu: { f16: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC", downloadMB: 870 },
  },
  {
    key: "qwen2.5-coder-7b",
    name: "Qwen 2.5 Coder 7B",
    maker: "Qwen",
    blurb: "Serious coding help",
    thinking: "never",
    tools: "qwen",
    code: true,
    gpu: { f16: "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-Coder-7B-Instruct-q4f32_1-MLC", downloadMB: 4280 },
  },
  {
    key: "deepseek-r1-qwen-7b",
    name: "DeepSeek R1 Distill 7B",
    maker: "DeepSeek",
    blurb: "Always thinks before it answers",
    thinking: "always",
    tools: null,
    gpu: { f16: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC", f32: "DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC", downloadMB: 4280 },
  },
  {
    key: "deepseek-r1-llama-8b",
    name: "DeepSeek R1 Distill 8B",
    maker: "DeepSeek",
    blurb: "R1 reasoning on Llama",
    thinking: "always",
    tools: null,
    gpu: { f16: "DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC", f32: "DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC", downloadMB: 4520 },
  },
  {
    key: "gemma-3-1b",
    name: "Gemma 3 1B",
    maker: "Google",
    blurb: "Google's smallest, friendly",
    thinking: "never",
    tools: null,
    /* WebLLM only ships this one in f16. */
    gpu: { f16: "gemma3-1b-it-q4f16_1-MLC", downloadMB: 600 },
    cpu: { repo: "onnx-community/gemma-3-1b-it-ONNX", dtype: "uint8", downloadMB: 1000 },
  },
  {
    key: "gemma-2-2b",
    name: "Gemma 2 2B",
    maker: "Google",
    blurb: "Natural, conversational",
    thinking: "never",
    tools: null,
    gpu: { f16: "gemma-2-2b-it-q4f16_1-MLC", f32: "gemma-2-2b-it-q4f32_1-MLC", downloadMB: 1470 },
  },
  {
    key: "gemma-2-9b",
    name: "Gemma 2 9B",
    maker: "Google",
    blurb: "Google's best writer here",
    thinking: "never",
    tools: null,
    gpu: { f16: "gemma-2-9b-it-q4f16_1-MLC", f32: "gemma-2-9b-it-q4f32_1-MLC", downloadMB: 5200 },
  },
  {
    key: "phi-4-mini",
    name: "Phi 4 mini",
    maker: "Microsoft",
    blurb: "Maths and logic punch",
    thinking: "never",
    tools: null,
    gpu: { f16: "Phi-4-mini-instruct-q4f16_1-MLC", f32: "Phi-4-mini-instruct-q4f32_1-MLC", downloadMB: 2160 },
  },
  {
    key: "phi-3.5-mini",
    name: "Phi 3.5 mini",
    maker: "Microsoft",
    blurb: "Compact and thorough",
    thinking: "never",
    tools: null,
    gpu: { f16: "Phi-3.5-mini-instruct-q4f16_1-MLC", f32: "Phi-3.5-mini-instruct-q4f32_1-MLC", downloadMB: 2150 },
  },
  {
    key: "ministral-3-3b",
    name: "Ministral 3 3B",
    maker: "Mistral",
    blurb: "Mistral's newest small model",
    thinking: "never",
    tools: null,
    gpu: {
      f16: "Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC",
      f32: "Ministral-3-3B-Instruct-2512-BF16-q4f32_1-MLC",
      downloadMB: 1950,
    },
  },
  {
    key: "mistral-7b",
    name: "Mistral 7B",
    maker: "Mistral",
    blurb: "A classic all-rounder",
    thinking: "never",
    tools: null,
    gpu: { f16: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC", f32: "Mistral-7B-Instruct-v0.3-q4f32_1-MLC", downloadMB: 4080 },
  },
  {
    key: "smollm2-360m",
    name: "SmolLM2 360M",
    maker: "Hugging Face",
    blurb: "The lightest download",
    thinking: "never",
    tools: null,
    gpu: { f16: "SmolLM2-360M-Instruct-q4f16_1-MLC", f32: "SmolLM2-360M-Instruct-q4f32_1-MLC", downloadMB: 200 },
    cpu: { repo: "HuggingFaceTB/SmolLM2-360M-Instruct", dtype: "q8", downloadMB: 370 },
  },
  {
    key: "smollm2-1.7b",
    name: "SmolLM2 1.7B",
    maker: "Hugging Face",
    blurb: "Small, open and quick",
    thinking: "never",
    tools: null,
    gpu: { f16: "SmolLM2-1.7B-Instruct-q4f16_1-MLC", f32: "SmolLM2-1.7B-Instruct-q4f32_1-MLC", downloadMB: 960 },
  },
  {
    key: "lfm2-350m",
    name: "LFM2 350M",
    maker: "Liquid AI",
    blurb: "Built to run fast on a processor",
    thinking: "never",
    tools: null,
    cpu: { repo: "onnx-community/LFM2-350M-ONNX", dtype: "q4", downloadMB: 300 },
  },
  {
    key: "lfm2-1.2b",
    name: "LFM2 1.2B",
    maker: "Liquid AI",
    blurb: "Fast processor model with more to say",
    thinking: "never",
    tools: null,
    cpu: { repo: "onnx-community/LFM2-1.2B-ONNX", dtype: "q4", downloadMB: 850 },
  },
];

/** What Auto runs: quick to download and fast on most devices. */
const AUTO_GPU = "llama-3.2-1b";
const AUTO_CPU = "qwen3-0.6b";

/* Keys from before the picker listed models by name. */
const RENAMED: Record<string, string> = {
  Fast: "llama-3.2-1b",
  Think: "qwen3-1.7b",
  Max: "llama-3.2-3b",
};

const byKey = new Map(LOCAL_MODELS.map((model) => [model.key, model]));

export function findModel(key: string | null | undefined): LocalModel | undefined {
  if (!key) return undefined;
  return byKey.get(RENAMED[key] ?? key);
}

/** Whether this device can run a model, and so whether the picker lists it. */
export function runsOn(model: LocalModel, support: SupportReport): boolean {
  if (support.backend === "cpu") return Boolean(model.cpu);
  if (!model.gpu) return false;
  return Boolean(model.gpu.f32 || support.specs.shaderF16);
}

/** The model a chat's key stands for on this device: the key's own model
 *  where it runs here, otherwise what Auto would pick. */
export function resolveModel(key: string | null | undefined, support: SupportReport): LocalModel {
  const model = findModel(key);
  if (model && runsOn(model, support)) return model;
  return byKey.get(support.backend === "cpu" ? AUTO_CPU : AUTO_GPU)!;
}

/** What actually runs a text turn on this device. */
export type Runtime =
  | {
      backend: "webgpu";
      /** The WebLLM model id. */
      id: string;
      model: LocalModel;
      downloadMB: number;
    }
  | {
      backend: "cpu";
      /** The Hugging Face repo. */
      id: string;
      dtype: string;
      model: LocalModel;
      downloadMB: number;
    };

export function runtimeFor(key: string | null | undefined, support: SupportReport): Runtime {
  const model = resolveModel(key, support);
  if (support.backend === "cpu" && model.cpu) {
    return { backend: "cpu", id: model.cpu.repo, dtype: model.cpu.dtype, model, downloadMB: model.cpu.downloadMB };
  }
  const gpu = model.gpu!;
  return {
    backend: "webgpu",
    id: support.specs.shaderF16 || !gpu.f32 ? gpu.f16 : gpu.f32,
    model,
    downloadMB: gpu.downloadMB,
  };
}
