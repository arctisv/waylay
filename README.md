# Waylay

A private AI chat that runs entirely in your browser. The model downloads once
to your device and runs there on the GPU (WebGPU); your chats, memories and
settings live in the browser's own storage. There is no account, no server and
no API key, and nothing you write ever leaves the device. Once loaded, it works
offline.

## What it does

- **On-device chat.** Three models, picked from the composer:
  - **Fast**: Llama 3.2 1B (about 660 MB). Auto uses this one.
  - **Thinking**: Qwen 3 1.7B (about 920 MB). Reasons before it answers when
    thinking is on.
  - **Heavy**: Llama 3.2 3B (about 1.7 GB).
- **Streaming replies** with stop, retry, edit, branch and roll back, plus a
  queue for messages typed while a reply is still being written.
- **Tools** the model can call: a calculator for exact arithmetic, and memory.
- **Memory.** The model remembers facts you share across chats. You can see,
  edit and delete every memory in Settings → Memory.
- **Voice input**, transcribed on the device with Whisper.
- **Chat history**: search, pin, rename, folders and incognito chats.
- **Text and code attachments**, read in the browser.
- **Installable** as an app (PWA) that keeps working offline.
- **Storage settings** that show what's downloaded, delete models and erase
  everything.

If the browser or device can't run the models (no WebGPU, or too little
memory), the app says so and lets you copy the link to open elsewhere.

## Requirements

A browser with WebGPU: a recent Chrome or Edge on desktop, Safari 26+ on
macOS or iOS, or Chrome on a recent Android phone. Plan for 4 GB of memory or
more, and room for the model download.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export to out/
npm run typecheck
npm run lint
npm run icons      # re-render the app icons from public/brand/mark.svg
```

The build is a static site. Set `NEXT_PUBLIC_BASE_PATH` to serve it from a
subfolder (for example `/waylay` on a GitHub Pages project site). The
workflow in `.github/workflows/deploy.yml` builds and publishes it to GitHub
Pages.

## How it fits together

- `app/`, `components/`: the interface.
- `lib/local/`: everything that replaces a backend.
  - `db.ts`, `idb.ts`: an in-memory database persisted to IndexedDB.
  - `functions.ts`, `react.ts`, `api.ts`, `backend/`: queries and mutations
    with reactive hooks (`useQuery`, `useMutation`).
  - `inference/`: the model engine (WebLLM in a Web Worker), the system
    prompt, tool calling, chat titles, and the turn runner that streams
    replies.
  - `speech/`: Whisper speech-to-text in a Web Worker
    (Transformers.js).
  - `device/`: the WebGPU and memory checks behind the "can't run" notice.
- `lib/view.tsx`: hash routes (`#/thread/<id>`, `#/settings`, `#/history`),
  so deep links work on any static host.

## Credits

Waylay's interface is built on [Whirl](https://github.com/whirlchat/whirl) by
Anterra, used under the MIT License (see [`LICENSE-WHIRL`](LICENSE-WHIRL)).
Waylay replaces Whirl's hosted backend with one that runs in the browser.

Models run with [WebLLM](https://github.com/mlc-ai/web-llm) and
[Transformers.js](https://github.com/huggingface/transformers.js). The
interface uses the [Inter](https://rsms.me/inter) typeface and
[Tabler Icons](https://tabler.io/icons).
