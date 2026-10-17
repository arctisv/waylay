"use client";

import type { MLCEngineInterface } from "@mlc-ai/web-llm";

/* The one model engine for the tab. It runs in a Web Worker so loading and
   generating never block the page, holds a single model at a time, and
   swaps models on demand. The library is imported on first use, so a page
   that never chats never downloads it. */

export type LoadProgress = {
  /** 0 to 1. */
  value: number;
  /** True when the weights came from the browser cache (loading, not downloading). */
  cached: boolean;
};

let engine: Promise<MLCEngineInterface> | null = null;
let worker: Worker | null = null;
let loadedModel: string | null = null;
/* Model loads run one at a time; a second request waits for the first. */
let loadChain: Promise<unknown> = Promise.resolve();

function webllm() {
  return import("@mlc-ai/web-llm");
}

/* Created empty; loadModel() below loads a model into it with progress. */
async function createEngine(): Promise<MLCEngineInterface> {
  const { WebWorkerMLCEngine } = await webllm();
  worker = new Worker(new URL("./llm.worker.ts", import.meta.url), {
    type: "module",
  });
  return new WebWorkerMLCEngine(worker);
}

/** Whether a model's files are already in the browser cache. */
export async function isModelCached(modelId: string): Promise<boolean> {
  try {
    const { hasModelInCache } = await webllm();
    return await hasModelInCache(modelId);
  } catch {
    return false;
  }
}

/** Frees a model's downloaded files. */
export async function deleteCachedModel(modelId: string): Promise<void> {
  const { deleteModelAllInfoInCache } = await webllm();
  if (loadedModel === modelId) await unloadModel();
  await deleteModelAllInfoInCache(modelId);
}

/** Loads a model (downloading it the first time) and returns the engine. */
export function loadModel(
  modelId: string,
  onProgress?: (progress: LoadProgress) => void,
): Promise<MLCEngineInterface> {
  const run = async () => {
    if (!engine) {
      engine = createEngine();
      engine.catch(() => {
        engine = null;
        worker?.terminate();
        worker = null;
      });
    }
    const instance = await engine;
    if (loadedModel === modelId) return instance;

    const cached = await isModelCached(modelId);
    /* A first download is hundreds of megabytes; ask the browser to keep it. */
    if (!cached) void navigator.storage?.persist?.().catch(() => false);
    onProgress?.({ value: 0, cached });
    instance.setInitProgressCallback((report) =>
      onProgress?.({ value: report.progress, cached }),
    );
    loadedModel = null;
    await instance.reload(modelId);
    loadedModel = modelId;
    return instance;
  };
  const next = loadChain.then(run, run);
  loadChain = next.catch(() => undefined);
  return next;
}

export function isModelLoaded(modelId: string): boolean {
  return loadedModel === modelId;
}

/** Stops whatever the engine is writing. Safe to call when it's idle. */
export async function interruptGeneration(): Promise<void> {
  if (!engine) return;
  const instance = await engine.catch(() => null);
  await instance?.interruptGenerate();
}

/** Releases the model from GPU memory. */
export async function unloadModel(): Promise<void> {
  if (!engine) return;
  const instance = await engine.catch(() => null);
  await instance?.unload();
  loadedModel = null;
}
