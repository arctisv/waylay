/* Paints pictures on this device: Janus Pro in Transformers.js, on the GPU
   through WebGPU. Text goes in, a 384 × 384 picture comes out, one image
   token at a time — which is also how progress is reported. */
import {
  AutoProcessor,
  BaseStreamer,
  MultiModalityCausalLM,
  type PreTrainedModel,
  type Processor,
} from "@huggingface/transformers";

type Request =
  | { type: "load"; id: number; repo: string; shaderF16: boolean }
  | { type: "paint"; id: number; prompt: string }
  | { type: "unload" };

type Janus = PreTrainedModel & {
  generate_images(options: Record<string, unknown>): Promise<{ toBlob(): Promise<Blob> }[]>;
};

let loaded: { repo: string; processor: Processor; model: Janus } | null = null;

const post = (message: Record<string, unknown>) => self.postMessage(message);

/* The 16-bit variants where the GPU has 16-bit shaders, 4-bit everywhere
   else; the prompt embedding runs on WebAssembly either way. */
function weightsFor(shaderF16: boolean) {
  return {
    dtype: shaderF16
      ? {
          prepare_inputs_embeds: "q8",
          language_model: "q4f16",
          lm_head: "q4f16",
          gen_head: "fp16",
          gen_img_embeds: "fp16",
          image_decode: "fp32",
        }
      : {
          prepare_inputs_embeds: "q8",
          language_model: "q4",
          lm_head: "q4",
          gen_head: "fp32",
          gen_img_embeds: "fp32",
          image_decode: "fp32",
        },
    device: {
      prepare_inputs_embeds: "wasm",
      language_model: "webgpu",
      lm_head: "webgpu",
      gen_head: "webgpu",
      gen_img_embeds: "webgpu",
      image_decode: "webgpu",
    },
  } as const;
}

async function load(id: number, repo: string, shaderF16: boolean) {
  if (loaded?.repo === repo) return post({ type: "loaded", id });
  /* Progress arrives per file; the bar is bytes across all of them. */
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (event: {
    status: string;
    file?: string;
    loaded?: number;
    total?: number;
    progress?: number;
  }) => {
    if (event.status !== "progress" || !event.file) return;
    /* Some hosts send no length; a file's own percentage stands in. */
    files.set(
      event.file,
      event.total
        ? { loaded: event.loaded ?? 0, total: event.total }
        : { loaded: event.progress ?? 0, total: 100 },
    );
    let done = 0;
    let total = 0;
    for (const file of files.values()) {
      done += file.loaded;
      total += file.total;
    }
    post({ type: "progress", id, value: total ? done / total : 0 });
  };
  const processor = await AutoProcessor.from_pretrained(repo, { progress_callback });
  const model = (await MultiModalityCausalLM.from_pretrained(repo, {
    ...weightsFor(shaderF16),
    progress_callback,
  } as Parameters<typeof MultiModalityCausalLM.from_pretrained>[1])) as Janus;
  loaded = { repo, processor, model };
  post({ type: "loaded", id });
}

/** Counts image tokens as they're generated, for the progress bar. */
class ProgressStreamer extends BaseStreamer {
  private count = 0;
  constructor(
    private readonly total: number,
    private readonly onProgress: (value: number) => void,
  ) {
    super();
  }
  put() {
    this.count += 1;
    if (this.count % 8 === 0) this.onProgress(Math.min(1, this.count / this.total));
  }
  end() {
    this.onProgress(1);
  }
}

async function paint(id: number, prompt: string) {
  if (!loaded) throw new Error("No image model is loaded.");
  const { processor, model } = loaded;
  const conversation = [{ role: "<|User|>", content: prompt }];
  const inputs = await (processor as unknown as (
    conversation: unknown,
    options: unknown,
  ) => Promise<Record<string, unknown>>)(conversation, { chat_template: "text_to_image" });
  const tokens = (processor as unknown as { num_image_tokens: number }).num_image_tokens;
  const [image] = await model.generate_images({
    ...inputs,
    min_new_tokens: tokens,
    max_new_tokens: tokens,
    do_sample: true,
    streamer: new ProgressStreamer(tokens, (value) => post({ type: "progress", id, value })),
  });
  const blob = await image.toBlob();
  post({ type: "painted", id, blob });
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  if (request.type === "unload") {
    await loaded?.model.dispose();
    loaded = null;
    return;
  }
  try {
    if (request.type === "load") await load(request.id, request.repo, request.shaderF16);
    else await paint(request.id, request.prompt);
  } catch (error) {
    post({
      type: "error",
      id: request.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
