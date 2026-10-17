"use client";

import type { MLCEngineInterface } from "@mlc-ai/web-llm";

import type { ChatEngine, GenerateRequest, LoadProgress } from "./engine";

/* The GPU engine: WebLLM in a Web Worker, so loading and generating never
   block the page. It holds one model at a time and swaps on demand. The
   library is imported on first use, so a page that never chats never
   downloads it. */

let engine: Promise<MLCEngineInterface> | null = null;
let worker: Worker | null = null;
let loadedModel: string | null = null;

function webllm() {
  return import("@mlc-ai/web-llm");
}

/* Created empty; load() below loads a model into it with progress. */
async function createEngine(): Promise<MLCEngineInterface> {
  const { WebWorkerMLCEngine } = await webllm();
  worker = new Worker(new URL("./webgpu.worker.ts", import.meta.url), {
    type: "module",
  });
  return new WebWorkerMLCEngine(worker);
}

/** Whether a model's files are already in the browser cache. */
export async function isWebgpuModelCached(modelId: string): Promise<boolean> {
  try {
    const { hasModelInCache } = await webllm();
    return await hasModelInCache(modelId);
  } catch {
    return false;
  }
}

/** Frees a model's downloaded files. */
export async function deleteWebgpuModel(modelId: string): Promise<void> {
  const { deleteModelAllInfoInCache } = await webllm();
  if (loadedModel === modelId) await unloadWebgpu();
  await deleteModelAllInfoInCache(modelId);
}

export function isWebgpuModelLoaded(modelId: string): boolean {
  return loadedModel === modelId;
}

/** Loads a model (downloading it the first time). */
export async function loadWebgpu(
  modelId: string,
  onProgress?: (progress: LoadProgress) => void,
): Promise<ChatEngine> {
  if (!engine) {
    engine = createEngine();
    engine.catch(() => {
      engine = null;
      worker?.terminate();
      worker = null;
    });
  }
  const instance = await engine;
  if (loadedModel !== modelId) {
    const cached = await isWebgpuModelCached(modelId);
    onProgress?.({ value: 0, cached });
    instance.setInitProgressCallback((report) =>
      onProgress?.({ value: report.progress, cached }),
    );
    loadedModel = null;
    await instance.reload(modelId);
    loadedModel = modelId;
  }
  return { generate: (request) => generate(instance, request) };
}

async function generate(engine: MLCEngineInterface, request: GenerateRequest) {
  const stream = await engine.chat.completions.create({
    messages: request.messages,
    stream: true,
    stream_options: { include_usage: true },
    temperature: request.temperature,
    top_p: request.topP,
    max_tokens: request.maxTokens,
    ...(request.enableThinking !== undefined
      ? { extra_body: { enable_thinking: request.enableThinking } }
      : {}),
  });
  let text = "";
  let completionTokens: number | undefined;
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (chunk.usage) completionTokens = chunk.usage.completion_tokens;
    if (!delta) continue;
    text += delta;
    request.onText?.(text);
  }
  return { text, completionTokens };
}

/** Stops whatever the engine is writing. Safe to call when it's idle. */
export async function interruptWebgpu(): Promise<void> {
  if (!engine) return;
  const instance = await engine.catch(() => null);
  await instance?.interruptGenerate();
}

/** Releases the model from GPU memory. */
export async function unloadWebgpu(): Promise<void> {
  if (!engine) return;
  const instance = await engine.catch(() => null);
  await instance?.unload();
  loadedModel = null;
}
