"use client";

import type { ChatEngine, GenerateRequest, LoadProgress } from "./engine";

/* The processor engine: Transformers.js in a Web Worker (cpu.worker.ts),
   for browsers and devices without a usable GPU. Same contract as the GPU
   engine — load with progress, stream text, stop on request. */

type Reply =
  | { type: "progress"; id: number; value: number }
  | { type: "loaded"; id: number }
  | { type: "text"; id: number; text: string }
  | { type: "done"; id: number; text: string; tokens: number }
  | { type: "error"; id: number; message: string };

type Job = {
  onProgress?: (value: number) => void;
  onText?: (text: string) => void;
  resolve: (reply: Reply) => void;
  reject: (error: Error) => void;
};

/* Transformers.js keeps every file it downloads in this cache. */
const CACHE_NAME = "transformers-cache";

let worker: Worker | null = null;
let loadedRepo: string | null = null;
let nextId = 0;
const jobs = new Map<number, Job>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./cpu.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const reply = event.data;
    const job = jobs.get(reply.id);
    if (!job) return;
    if (reply.type === "progress") return job.onProgress?.(reply.value);
    if (reply.type === "text") return job.onText?.(reply.text);
    jobs.delete(reply.id);
    if (reply.type === "error") job.reject(new Error(reply.message));
    else job.resolve(reply);
  };
  /* A worker that can't start (or dies) answers nothing; fail its jobs
     instead of leaving the turn waiting forever. */
  worker.onerror = (event) => {
    event.preventDefault();
    const error = new Error(event.message || "The processor model stopped working.");
    for (const job of jobs.values()) job.reject(error);
    jobs.clear();
    worker?.terminate();
    worker = null;
    loadedRepo = null;
  };
  return worker;
}

function send(message: Record<string, unknown>, job: Omit<Job, "resolve" | "reject">) {
  const id = (nextId += 1);
  return new Promise<Reply>((resolve, reject) => {
    jobs.set(id, { ...job, resolve, reject });
    getWorker().postMessage({ ...message, id });
  });
}

/** Whether a repo's weights are already in the browser cache. */
export async function isCpuModelCached(repo: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    if (!(await caches.has(CACHE_NAME))) return false;
    const keys = await (await caches.open(CACHE_NAME)).keys();
    return keys.some((request) => request.url.includes(repo) && request.url.endsWith(".onnx"));
  } catch {
    return false;
  }
}

/** Frees a repo's downloaded files, leaving other models' files alone. */
export async function deleteCpuModel(repo: string): Promise<void> {
  if (loadedRepo === repo) unloadCpu();
  if (typeof caches === "undefined" || !(await caches.has(CACHE_NAME))) return;
  const cache = await caches.open(CACHE_NAME);
  for (const request of await cache.keys()) {
    if (request.url.includes(repo)) await cache.delete(request);
  }
}

export function isCpuModelLoaded(repo: string): boolean {
  return loadedRepo === repo;
}

export async function loadCpu(
  repo: string,
  dtype: string,
  onProgress?: (progress: LoadProgress) => void,
): Promise<ChatEngine> {
  if (loadedRepo !== repo) {
    const cached = await isCpuModelCached(repo);
    onProgress?.({ value: 0, cached });
    loadedRepo = null;
    await send(
      { type: "load", repo, dtype },
      { onProgress: (value) => onProgress?.({ value, cached }) },
    );
    loadedRepo = repo;
  }
  return { generate };
}

async function generate(request: GenerateRequest) {
  const reply = await send(
    {
      type: "generate",
      messages: request.messages,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      topP: request.topP,
      enableThinking: request.enableThinking,
    },
    { onText: request.onText },
  );
  return reply.type === "done"
    ? { text: reply.text, completionTokens: reply.tokens }
    : { text: "" };
}

export function interruptCpu(): void {
  worker?.postMessage({ type: "interrupt" });
}

export function unloadCpu(): void {
  worker?.postMessage({ type: "unload" });
  loadedRepo = null;
}
