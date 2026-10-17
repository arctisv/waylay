"use client";

import type { LoadProgress } from "./engine";
import { isCpuModelCached } from "./cpu-engine";

/* The picture engine: Janus Pro in a Web Worker (image.worker.ts). It
   needs WebGPU and memory to spare, so the text engine steps aside while
   it's loaded (turns.ts sees to that). */

export const IMAGE_MODEL = {
  label: "Janus Pro 1B",
  company: "DeepSeek",
  repo: "onnx-community/Janus-Pro-1B-ONNX",
  downloadMB: 1600,
};

type Reply =
  | { type: "progress"; id: number; value: number }
  | { type: "loaded"; id: number }
  | { type: "painted"; id: number; blob: Blob }
  | { type: "error"; id: number; message: string };

type Job = {
  onProgress?: (value: number) => void;
  resolve: (reply: Reply) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let loaded = false;
let nextId = 0;
const jobs = new Map<number, Job>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./image.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const reply = event.data;
    const job = jobs.get(reply.id);
    if (!job) return;
    if (reply.type === "progress") return job.onProgress?.(reply.value);
    jobs.delete(reply.id);
    if (reply.type === "error") job.reject(new Error(reply.message));
    else job.resolve(reply);
  };
  return worker;
}

function send(message: Record<string, unknown>, onProgress?: (value: number) => void) {
  const id = (nextId += 1);
  return new Promise<Reply>((resolve, reject) => {
    jobs.set(id, { onProgress, resolve, reject });
    getWorker().postMessage({ ...message, id });
  });
}

export function isImageModelLoaded(): boolean {
  return loaded;
}

export async function loadImageModel(
  shaderF16: boolean,
  onProgress?: (progress: LoadProgress) => void,
): Promise<void> {
  if (loaded) return;
  const cached = await isCpuModelCached(IMAGE_MODEL.repo);
  onProgress?.({ value: 0, cached });
  await send({ type: "load", repo: IMAGE_MODEL.repo, shaderF16 }, (value) =>
    onProgress?.({ value, cached }),
  );
  loaded = true;
}

/** Paints one picture; progress runs 0 to 1 over its image tokens. */
export async function paintImage(
  prompt: string,
  onProgress?: (value: number) => void,
): Promise<Blob> {
  const reply = await send({ type: "paint", prompt }, onProgress);
  if (reply.type !== "painted") throw new Error("The picture didn't come out.");
  return reply.blob;
}

/** Frees the image model's GPU memory. The worker stays for next time. */
export function unloadImageModel(): void {
  if (!loaded) return;
  worker?.postMessage({ type: "unload" });
  loaded = false;
}
