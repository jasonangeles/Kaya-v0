#!/usr/bin/env node
/**
 * Generate favicons + iOS/PWA app icons from one logo SVG.
 *
 *   Input : public/logo-icon.svg   (export Figma node "logo v3" as SVG)
 *   Output: public/favicon.ico (16/32/48), favicon-16.png, favicon-32.png,
 *           icon-180.png (apple-touch-icon), icon-192.png, icon-512.png
 *
 * Usage: npm run icons
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'public/logo-icon.svg');
const OUT = (f) => resolve(ROOT, 'public', f);
const BG = '#000000';

if (!existsSync(SRC)) {
  console.error('\n  Missing public/logo-icon.svg — export the Figma logo as SVG to that path.\n');
  process.exit(1);
}

// Pull the logo's viewBox + inner markup so it can be nested at any size/offset.
const raw = readFileSync(SRC, 'utf8');
const open = raw.match(/<svg[^>]*>/i)[0];
const inner = raw.slice(raw.indexOf(open) + open.length, raw.lastIndexOf('</svg>'));
// Crop to the drawn content's bounding box, so any margin baked into the
// exported frame doesn't shrink the logo — padding is controlled below.
const bbox = new Resvg(raw).getBBox();
const vbFallback = (open.match(/viewBox="([^"]+)"/i)?.[1]) || '0 0 32 32';
const vb = bbox ? `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}` : vbFallback;
const [, , vw, vh] = vb.split(/[\s,]+/).map(Number);

/** Render the logo centered on a black square, scaled so its longer side = `fill` of the canvas. */
function render(size, fill) {
  const scale = (size * fill) / Math.max(vw, vh);
  const w = vw * scale, h = vh * scale;
  const x = (size - w) / 2, y = (size - h) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    <svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}">${inner}</svg>
  </svg>`;
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

// Tab favicons: logo nearly fills the square (matches the 32px Figma frame).
// iOS / PWA: more padding — iOS rounds the corners and Android masks to ~80%.
const jobs = [
  ['favicon-16.png', 16, 0.88],
  ['favicon-32.png', 32, 0.88],
  ['icon-180.png', 180, 0.6],
  ['icon-192.png', 192, 0.56],
  ['icon-512.png', 512, 0.56],
];
for (const [file, size, fill] of jobs) {
  writeFileSync(OUT(file), render(size, fill));
  console.log(`  ✓ ${file} (${size}×${size})`);
}

// favicon.ico with PNG-encoded 16/32/48 entries (supported by all modern browsers).
const icoSizes = [16, 32, 48];
const pngs = icoSizes.map((s) => render(s, 0.88));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
const dir = Buffer.alloc(16 * pngs.length);
let offset = 6 + dir.length;
pngs.forEach((png, i) => {
  const s = icoSizes[i], o = i * 16;
  dir.writeUInt8(s, o); dir.writeUInt8(s, o + 1); dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
  dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
  dir.writeUInt32LE(png.length, o + 8); dir.writeUInt32LE(offset, o + 12);
  offset += png.length;
});
writeFileSync(OUT('favicon.ico'), Buffer.concat([header, dir, ...pngs]));
console.log('  ✓ favicon.ico (16/32/48)\n  Done.');
