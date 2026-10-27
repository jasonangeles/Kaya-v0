#!/usr/bin/env node
/**
 * Build-time institution logo fetcher.
 *
 * Downloads each institution's logo ONCE from logo.dev and saves it to
 * src/assets/logos/<id>.png. Those files are then bundled by Vite, so the
 * running app makes ZERO network calls for logos and never reveals which
 * banks a user holds. Misses fall back to our own brand-colored monogram.
 *
 * Usage:
 *   LOGO_DEV_KEY=pk_xxx node scripts/fetch-logos.mjs          # fetch missing only
 *   LOGO_DEV_KEY=pk_xxx node scripts/fetch-logos.mjs --force  # re-download all
 *
 * Get a free key (publishable, pk_...) at https://logo.dev — 500K/month free.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REGISTRY = resolve(ROOT, 'src/data/institutions.ts');
const OUT_DIR = resolve(ROOT, 'src/assets/logos');

const KEY = process.env.LOGO_DEV_KEY;
const FORCE = process.argv.includes('--force');

if (!KEY) {
  console.warn('\n  No LOGO_DEV_KEY set — skipping downloads, re-analyzing existing logos only.');
  console.warn('  To fetch new/updated logos, get a free key (pk_...) at https://logo.dev, then run:');
  console.warn('    LOGO_DEV_KEY=pk_xxx node scripts/fetch-logos.mjs\n');
}

// Pull { id, domain } pairs straight out of the registry source.
const src = readFileSync(REGISTRY, 'utf8');
const re = /id:\s*'([^']+)'[^}]*?domain:\s*'([^']+)'/g;
const entries = [];
let m;
while ((m = re.exec(src)) !== null) entries.push({ id: m[1], domain: m[2] });

if (!entries.length) {
  console.error('No { id, domain } pairs found in', REGISTRY);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const url = (domain) =>
  `https://img.logo.dev/${domain}?token=${KEY}&size=128&retina=true&format=png&fallback=404`;

let saved = 0, skipped = 0, missed = 0;
const misses = [];

for (const { id, domain } of KEY ? entries : []) {
  const out = resolve(OUT_DIR, `${id}.png`);
  if (!FORCE && existsSync(out)) { skipped++; continue; }
  try {
    const res = await fetch(url(domain));
    if (!res.ok) { missed++; misses.push(`${id} (${domain}) → ${res.status}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) { missed++; misses.push(`${id} (${domain}) → empty`); continue; }
    writeFileSync(out, buf);
    saved++;
    console.log(`  ✓ ${id.padEnd(18)} ${domain}`);
  } catch (e) {
    missed++; misses.push(`${id} (${domain}) → ${e.message}`);
  }
}

console.log(`\n  Done. ${saved} saved, ${skipped} already present, ${missed} missed (monogram fallback).`);
if (misses.length) console.log('  Missed (kept as monogram):\n   ', misses.join('\n    '));

// ---------------------------------------------------------------------------
// Background detection
//
// Many logos come as a full, opaque branded tile (e.g. Chase's blue square),
// not an isolated mark on transparency. Rendered on a white tile those float
// in a white square. Here we sample each PNG's border to recover the logo's
// OWN background and write it to src/data/logoBackgrounds.ts, which the
// InstitutionLogo component uses as the tile color so the mark sits flush.
//
//  - Mostly-transparent border  → isolated mark, no entry (white tile is fine).
//  - Opaque, ~flat border       → that flat color.
//  - Opaque, top≠bottom border  → vertical linear-gradient (dominant approx).
//  - Opaque, near-white border  → no entry (already matches the white tile).
// ---------------------------------------------------------------------------
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
const avg = (list) => {
  if (!list.length) return null;
  const s = list.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]);
  return [s[0] / list.length, s[1] / list.length, s[2] / list.length];
};

function detectBg(file) {
  const png = PNG.sync.read(readFileSync(file));
  const { width: w, height: h, data } = png;
  const pad = Math.max(2, Math.round(Math.min(w, h) * 0.06));
  const at = (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  const top = [], bottom = [], all = [];
  let border = 0, transparent = 0;
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    if (x >= pad && x < w - pad && y >= pad && y < h - pad) continue; // interior
    border++;
    const [r, g, b, a] = at(x, y);
    if (a < 128) { transparent++; continue; }
    const px = [r, g, b];
    all.push(px);
    if (y < pad) top.push(px);
    if (y >= h - pad) bottom.push(px);
  }
  if (transparent / border > 0.5) return null;           // isolated mark
  const mean = avg(all);
  if (!mean) return null;
  if (mean[0] > 245 && mean[1] > 245 && mean[2] > 245) return null; // ~white, keep default
  const tAvg = avg(top), bAvg = avg(bottom);
  if (tAvg && bAvg && dist(tAvg, bAvg) > 60) {
    return `linear-gradient(180deg, ${hex(...tAvg)}, ${hex(...bAvg)})`;
  }
  return hex(...mean);
}

// Manual overrides for edge cases where auto-detection isn't ideal.
//   '<id>': '#rrggbb'                → force this flat tile color
//   '<id>': 'linear-gradient(...)'   → force this gradient
//   '<id>': null                     → force the plain white tile (skip)
const OVERRIDES = {
  wellsfargo: '#eb0018', // asset carries a gold bottom band; keep the tile flat red
};

const bgMap = {};
for (const f of readdirSync(OUT_DIR).filter((f) => f.endsWith('.png')).sort()) {
  const id = f.replace(/\.png$/, '');
  if (id in OVERRIDES) { if (OVERRIDES[id]) bgMap[id] = OVERRIDES[id]; continue; }
  try { const bg = detectBg(resolve(OUT_DIR, f)); if (bg) bgMap[id] = bg; }
  catch (e) { console.warn('  bg detect failed for', id, '-', e.message); }
}

const outTs = resolve(ROOT, 'src/data/logoBackgrounds.ts');
const body = Object.entries(bgMap).map(([id, bg]) => `  ${id}: ${JSON.stringify(bg)},`).join('\n');
writeFileSync(outTs,
`// AUTO-GENERATED by scripts/fetch-logos.mjs — do not edit by hand.
// Tile background color for logos that ship with their own opaque background,
// so the mark sits flush instead of floating in a white square. Logos not
// listed here are isolated marks and use the default white tile.
export const LOGO_BG: Record<string, string> = {
${body}
};
`);
console.log(`\n  Backgrounds: ${Object.keys(bgMap).length} logos matched to their own tile color → src/data/logoBackgrounds.ts`);
