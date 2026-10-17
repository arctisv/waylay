/* Runs the model off the main thread so the page stays smooth while it
   loads and generates. */
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (message: MessageEvent) => {
  handler.onmessage(message);
};
