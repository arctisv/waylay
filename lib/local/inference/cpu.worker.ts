/* The processor engine's worker: a small chat model in Transformers.js on
   WebAssembly, for browsers and devices without a usable GPU. One model at
   a time; generation streams text back and stops on request. */
import {
  AutoModelForCausalLM,
  AutoTokenizer,
  InterruptableStoppingCriteria,
  TextStreamer,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";

type Request =
  | { type: "load"; id: number; repo: string; dtype: string }
  | {
      type: "generate";
      id: number;
      messages: { role: string; content: string }[];
      maxTokens: number;
      temperature: number;
      topP?: number;
      /** Qwen 3's switch, read by its chat template. */
      enableThinking?: boolean;
    }
  | { type: "interrupt" }
  | { type: "unload" };

let loaded: { repo: string; tokenizer: PreTrainedTokenizer; model: PreTrainedModel } | null = null;
const stopping = new InterruptableStoppingCriteria();

const post = (message: Record<string, unknown>) => self.postMessage(message);

async function load(id: number, repo: string, dtype: string) {
  if (loaded?.repo === repo) return post({ type: "loaded", id });
  await loaded?.model.dispose();
  loaded = null;
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
  const tokenizer = await AutoTokenizer.from_pretrained(repo, { progress_callback });
  const model = await AutoModelForCausalLM.from_pretrained(repo, {
    dtype: dtype as "q8",
    device: "wasm",
    progress_callback,
  });
  loaded = { repo, tokenizer, model };
  post({ type: "loaded", id });
}

async function generate(request: Extract<Request, { type: "generate" }>) {
  if (!loaded) throw new Error("No model is loaded.");
  const { tokenizer, model } = loaded;
  stopping.reset();
  /* Extra options reach the chat template as variables; Qwen 3's reads
     enable_thinking. The typings only list the tokenizer's own options. */
  const options = {
    add_generation_prompt: true,
    return_dict: true,
    enable_thinking: request.enableThinking ?? false,
  } as Parameters<PreTrainedTokenizer["apply_chat_template"]>[1];
  const inputs = tokenizer.apply_chat_template(request.messages, options) as Record<
    string,
    unknown
  >;
  let text = "";
  let tokens = 0;
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    /* <think> tags aren't special tokens, so a reply's reasoning still
       reaches the turn runner; end-of-turn markers are dropped. */
    skip_special_tokens: true,
    callback_function: (piece: string) => {
      text += piece;
      post({ type: "text", id: request.id, text });
    },
    token_callback_function: () => {
      tokens += 1;
    },
  });
  await model.generate({
    ...inputs,
    max_new_tokens: request.maxTokens,
    do_sample: request.temperature > 0,
    temperature: request.temperature,
    top_p: request.topP,
    streamer,
    stopping_criteria: stopping,
  });
  post({ type: "done", id: request.id, text, tokens });
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  if (request.type === "interrupt") {
    stopping.interrupt();
    return;
  }
  if (request.type === "unload") {
    await loaded?.model.dispose();
    loaded = null;
    return;
  }
  try {
    if (request.type === "load") await load(request.id, request.repo, request.dtype);
    else await generate(request);
  } catch (error) {
    post({
      type: "error",
      id: request.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
