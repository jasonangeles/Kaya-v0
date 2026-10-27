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
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REGISTRY = resolve(ROOT, 'src/data/institutions.ts');
const OUT_DIR = resolve(ROOT, 'src/assets/logos');

const KEY = process.env.LOGO_DEV_KEY;
const FORCE = process.argv.includes('--force');

if (!KEY) {
  console.error('\n  Missing LOGO_DEV_KEY.');
  console.error('  Get a free publishable key (pk_...) at https://logo.dev, then run:');
  console.error('    LOGO_DEV_KEY=pk_xxx node scripts/fetch-logos.mjs\n');
  process.exit(1);
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

for (const { id, domain } of entries) {
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
