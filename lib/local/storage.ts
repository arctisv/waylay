"use client";

import { db } from "./db";
import { deleteCpuModel, isCpuModelCached } from "./inference/cpu-engine";
import { unloadEngine } from "./inference/engine";
import type { LocalModel } from "./inference/models";
import { deleteWebgpuModel, isWebgpuModelCached } from "./inference/webgpu-engine";

/* What Waylay keeps in this browser beyond the chats themselves: model
   downloads (in the Cache API, put there by WebLLM and Transformers.js)
   and the space they take. Everything here is local; deleting only frees
   space, and a deleted model downloads again the next time it's needed. */

const gpuBuilds = (model: LocalModel) =>
  model.gpu ? [model.gpu.f16, model.gpu.f32].filter((id): id is string => Boolean(id)) : [];

/** Whether either GPU build of a chat model is downloaded. */
export async function isGpuBuildDownloaded(model: LocalModel): Promise<boolean> {
  const results = await Promise.all(gpuBuilds(model).map(isWebgpuModelCached));
  return results.some(Boolean);
}

export async function deleteGpuBuild(model: LocalModel): Promise<void> {
  for (const build of gpuBuilds(model)) {
    if (await isWebgpuModelCached(build)) await deleteWebgpuModel(build);
  }
}

/* Models fetched with Transformers.js — the processor chat models and
   voice — are addressed by their Hugging Face repo. */
export const isRepoDownloaded = isCpuModelCached;
export const deleteRepoDownload = deleteCpuModel;

/** Bytes this site uses and may use, when the browser says. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const estimate = await navigator.storage?.estimate();
    if (!estimate?.quota) return null;
    return { usage: estimate.usage ?? 0, quota: estimate.quota };
  } catch {
    return null;
  }
}

/** Asks the browser not to evict model downloads when space runs low. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (await navigator.storage?.persisted()) return;
    await navigator.storage?.persist();
  } catch {
    /* Not supported here; downloads stay best-effort. */
  }
}

/** Removes every chat, memory, setting and download, then starts fresh. */
export async function eraseEverything(): Promise<void> {
  await unloadEngine().catch(() => {});
  await db.clearAll();
  if (typeof caches !== "undefined") {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* Storage blocked; nothing was saved there either. */
  }
  location.reload();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
