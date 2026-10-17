/* Speech to text, on this device: Whisper running in a worker so the page
   stays smooth. The model downloads once (about 80 MB) and is cached by
   the browser after that. */
import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

import { SPEECH_MODEL } from "./model";

const MODEL = SPEECH_MODEL.repo;

type Request = { id: number; audio: Float32Array };

let transcriber: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function load(onProgress: (value: number) => void) {
  const progress_callback = (event: { status: string; progress?: number }) => {
    if (event.status === "progress" && typeof event.progress === "number") {
      onProgress(event.progress / 100);
    }
  };
  /* The GPU is much faster; plain WebAssembly works everywhere else. */
  return pipeline("automatic-speech-recognition", MODEL, {
    device: "webgpu",
    dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
    progress_callback,
  }).catch(() =>
    pipeline("automatic-speech-recognition", MODEL, {
      device: "wasm",
      dtype: "q8",
      progress_callback,
    }),
  ) as Promise<AutomaticSpeechRecognitionPipeline>;
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const { id, audio } = event.data;
  try {
    if (!transcriber) {
      transcriber = load((value) => self.postMessage({ id, type: "progress", value }));
      transcriber.catch(() => {
        transcriber = null;
      });
    }
    const asr = await transcriber;
    const output = await asr(audio, { chunk_length_s: 30, stride_length_s: 5 });
    const text = (Array.isArray(output) ? output : [output])
      .map((part) => part.text)
      .join(" ")
      .trim();
    self.postMessage({ id, type: "done", text });
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
