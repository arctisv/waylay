# Waylay

A private AI chat that runs entirely in the browser. The model runs on the visitor's own device through WebGPU, so there is no server and nothing typed ever leaves the device.

This is the first step: the screens shown when a browser or device can't run a model. Chat isn't built yet, so every visitor currently lands on one of these screens (see `src/config/features.ts`).

## Getting started

```sh
npm install
npm run dev
```

Then open http://localhost:3000.

### Previewing each screen

The app checks the device on load and shows the matching screen. To see a specific one, add `?preview=` to the URL:

- `?preview=browser` shows "Your browser can't run Waylay"
- `?preview=device` shows "This device needs a bit more power"

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server |
| `npm run build` | Builds a static site into `out/` |
| `npm run start` | Serves the built site from `out/` |
| `npm run lint` | Runs ESLint |
| `npm run typecheck` | Runs the TypeScript compiler |
| `npm run icons` | Regenerates the favicon and app icons from `src/assets/brand` |

## Project structure

```
src/
  app/            Next.js routes, metadata, manifest and generated icons
  assets/brand/   Source SVGs for the app icon
  components/
    brand/        App icon and logo
    icons/        Custom SVG glyphs and illustrations
    layout/       App shell and header
    pwa/          Service worker registration
    support/      Device check and the "can't run here" screens
    ui/           Buttons and status pill
  config/         Site text, feature flags, device requirements and supported browsers
  hooks/          Device check and clipboard hooks
  lib/            Device detection and formatting helpers
  styles/         Global styles, design tokens and fonts
public/
  icons/          PWA icons
  sw.js           Service worker for offline use
```

## Deploying

`npm run build` produces a fully static site in `out/`. It can be hosted on any static host, such as GitHub Pages, Cloudflare Pages or Netlify.
