"use client";

import { db } from "./db";
import { deleteCachedModel, isModelCached, unloadModel } from "./inference/engine";
import type { LocalModel } from "./inference/models";

/* What Waylay keeps in this browser beyond the chats themselves: model
   downloads (in the Cache API, put there by WebLLM and Transformers.js)
   and the space they take. Everything here is local; deleting only frees
   space, and a deleted model downloads again the next time it's needed. */

/* Transformers.js caches every model it fetches under this name. */
const SPEECH_CACHE = "transformers-cache";

const builds = (model: LocalModel) => [model.builds.f16, model.builds.f32];

/** Whether either build of a chat model is downloaded. */
export async function isModelDownloaded(model: LocalModel): Promise<boolean> {
  const results = await Promise.all(builds(model).map(isModelCached));
  return results.some(Boolean);
}

export async function deleteModelDownload(model: LocalModel): Promise<void> {
  for (const build of builds(model)) {
    if (await isModelCached(build)) await deleteCachedModel(build);
  }
}

/** Whether the voice model (Whisper) is downloaded. */
export async function isSpeechModelDownloaded(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    if (!(await caches.has(SPEECH_CACHE))) return false;
    const keys = await (await caches.open(SPEECH_CACHE)).keys();
    return keys.some((request) => request.url.includes("whisper"));
  } catch {
    return false;
  }
}

export async function deleteSpeechModel(): Promise<void> {
  if (typeof caches === "undefined") return;
  await caches.delete(SPEECH_CACHE);
}

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
  await unloadModel().catch(() => {});
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
