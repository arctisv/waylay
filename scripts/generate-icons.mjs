// Generates every icon size from the brand SVGs in src/assets/brand.
// Run with `npm run icons` after changing the logo, then commit the output.
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const path = (p) => new URL(p, root);

const rounded = await readFile(path('src/assets/brand/app-icon.svg'));
const fullBleed = await readFile(path('src/assets/brand/app-icon-full-bleed.svg'));

const png = (svg, size) => sharp(svg, { density: 72 * (size / 100) * 2 }).resize(size, size).png().toBuffer();

// Packs PNG images into a single .ico file (PNG-compressed entries, supported by every current browser).
function toIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const outputs = [
  ['public/icons/icon-192.png', await png(rounded, 192)],
  ['public/icons/icon-512.png', await png(rounded, 512)],
  ['public/icons/icon-maskable-512.png', await png(fullBleed, 512)],
  ['src/app/apple-icon.png', await png(fullBleed, 180)],
  [
    'src/app/favicon.ico',
    toIco(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(rounded, size) })))),
  ],
];

for (const [file, data] of outputs) {
  await writeFile(path(file), data);
  console.log(`wrote ${file}`);
}

await copyFile(path('src/assets/brand/app-icon.svg'), path('src/app/icon.svg'));
console.log('wrote src/app/icon.svg');
