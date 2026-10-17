"use client";

/* Turns a recorded clip into text on this device: decode it to the 16 kHz
   mono audio Whisper expects, then hand it to the speech worker. */

const SAMPLE_RATE = 16_000;

type Pending = {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  onProgress?: (value: number) => void;
};

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./speech.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (event: MessageEvent) => {
    const message = event.data as
      | { id: number; type: "progress"; value: number }
      | { id: number; type: "done"; text: string }
      | { id: number; type: "error"; message: string };
    const job = pending.get(message.id);
    if (!job) return;
    if (message.type === "progress") {
      job.onProgress?.(message.value);
      return;
    }
    pending.delete(message.id);
    if (message.type === "done") job.resolve(message.text);
    else job.reject(new Error(message.message));
  };
  return worker;
}

async function decode(clip: Blob): Promise<Float32Array> {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    const audio = await context.decodeAudioData(await clip.arrayBuffer());
    if (audio.numberOfChannels === 1) return audio.getChannelData(0);
    /* Mix down to mono. */
    const mono = new Float32Array(audio.length);
    for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
      const data = audio.getChannelData(channel);
      for (let index = 0; index < data.length; index += 1) {
        mono[index] += data[index] / audio.numberOfChannels;
      }
    }
    return mono;
  } finally {
    void context.close().catch(() => {});
  }
}

export async function transcribeLocally(
  clip: Blob,
  onProgress?: (value: number) => void,
): Promise<string> {
  let audio: Float32Array;
  try {
    audio = await decode(clip);
  } catch {
    throw new Error("Couldn't read that recording. Try again?");
  }
  const id = (nextId += 1);
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, audio }, [audio.buffer]);
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    if (/fetch|network/i.test(message)) {
      throw new Error("Couldn't download the speech model. Check your connection and try again.");
    }
    throw new Error("Voice input couldn't transcribe that. Try again?");
  });
}
