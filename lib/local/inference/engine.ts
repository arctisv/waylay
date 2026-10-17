"use client";

import {
  interruptCpu,
  isCpuModelLoaded,
  loadCpu,
  unloadCpu,
} from "./cpu-engine";
import type { Runtime } from "./models";
import {
  interruptWebgpu,
  isWebgpuModelLoaded,
  loadWebgpu,
  unloadWebgpu,
} from "./webgpu-engine";

/* The one model engine for the tab, whichever backend runs it: WebLLM on
   the GPU, or Transformers.js on the processor (models.ts picks). Loads
   run one at a time, and only one backend holds a model at once. */

export type LoadProgress = {
  /** 0 to 1. */
  value: number;
  /** True when the weights came from the browser cache (loading, not downloading). */
  cached: boolean;
};

export type EngineMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GenerateRequest = {
  messages: EngineMessage[];
  maxTokens: number;
  temperature: number;
  topP?: number;
  /** For reasoning models: think first, or answer straight away. */
  enableThinking?: boolean;
  /** Called with the reply so far each time it grows. */
  onText?: (text: string) => void;
};

export type GenerateResult = { text: string; completionTokens?: number };

export type ChatEngine = {
  generate(request: GenerateRequest): Promise<GenerateResult>;
};

let active: Runtime["backend"] | null = null;
let chain: Promise<unknown> = Promise.resolve();

export function isRuntimeLoaded(runtime: Runtime): boolean {
  return runtime.backend === "webgpu"
    ? isWebgpuModelLoaded(runtime.id)
    : isCpuModelLoaded(runtime.id);
}

/** Loads a runtime's model (downloading it the first time). */
export function loadRuntime(
  runtime: Runtime,
  onProgress?: (progress: LoadProgress) => void,
): Promise<ChatEngine> {
  const run = async () => {
    if (active && active !== runtime.backend) await unloadEngine();
    active = runtime.backend;
    return runtime.backend === "webgpu"
      ? loadWebgpu(runtime.id, onProgress)
      : loadCpu(runtime.id, runtime.dtype, onProgress);
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}

/** Stops whatever the engine is writing. Safe to call when it's idle. */
export async function interruptGeneration(): Promise<void> {
  if (active === "webgpu") await interruptWebgpu();
  else if (active === "cpu") interruptCpu();
}

/** Releases the loaded model, wherever it lives. */
export async function unloadEngine(): Promise<void> {
  if (active === "webgpu") await unloadWebgpu();
  else if (active === "cpu") unloadCpu();
  active = null;
}
