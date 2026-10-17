// Renders the app icons and the social card from the mark in
// public/brand/mark.svg: the white mark centered on a dark canvas.
// Run with `npm run icons` after changing the mark, then commit the output.
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const path = (p) => new URL(p, root);

const BACKGROUND = "#161616";
const mark = (await readFile(path("public/brand/mark.svg"), "utf8")).replaceAll(
  "black",
  "white",
);

/** A square icon with the mark filling `scale` of its width. */
async function icon(size, scale) {
  const markSize = Math.round(size * scale);
  const art = await sharp(Buffer.from(mark), { density: 72 * (markSize / 180) * 2 })
    .resize(markSize, markSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toBuffer();
}

/** The link-preview card: the mark on a deep diagonal gradient. */
async function socialCard() {
  const background = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#0d5aa6"/>
      </linearGradient></defs>
      <rect width="1200" height="630" fill="url(#g)"/>
    </svg>`,
  );
  const art = await sharp(Buffer.from(mark), { density: 144 })
    .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp(background).composite([{ input: art, gravity: "center" }]).png().toBuffer();
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
