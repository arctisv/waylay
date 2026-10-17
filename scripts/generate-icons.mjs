// Renders the app icons and the social card from the mark in
// public/brand/mark.svg: the white mark on Waylay's accent — a black-to-blue
// gradient under a film of grain, the same recipe as app/accents.css.
// Run with `npm run icons` after changing the mark, then commit the output.
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const path = (p) => new URL(p, root);

const mark = (await readFile(path("public/brand/mark.svg"), "utf8")).replaceAll(
  "black",
  "white",
);

/** The accent canvas at any size: the light-mode gradient plus grain. */
function canvas(width, height) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#09090b"/>
          <stop offset="0.52" stop-color="#0c1c52"/>
          <stop offset="1" stop-color="#2563eb"/>
        </linearGradient>
        <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#a)"/>
      <rect width="100%" height="100%" filter="url(#g)" opacity="0.12"/>
    </svg>`,
  );
}

async function markArt(size) {
  return sharp(Buffer.from(mark), { density: 72 * (size / 180) * 2 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/** A square icon with the mark filling `scale` of its width. */
async function icon(size, scale) {
  const art = await markArt(Math.round(size * scale));
  return sharp(canvas(size, size))
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toBuffer();
}

/** The link-preview card: the mark on the accent. */
async function socialCard() {
  const art = await markArt(190);
  return sharp(canvas(1200, 630))
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toBuffer();
}

const outputs = [
  ["public/icons/icon-192.png", await icon(192, 0.5)],
  ["public/icons/icon-512.png", await icon(512, 0.5)],
  /* Pulled in far enough to survive any crop Android applies. */
  ["public/icons/icon-maskable-512.png", await icon(512, 0.4)],
  ["app/apple-icon.png", await icon(180, 0.5)],
  ["public/brand/og.png", await socialCard()],
];

for (const [file, data] of outputs) {
  await writeFile(path(file), data);
  console.log(`wrote ${file}`);
}
