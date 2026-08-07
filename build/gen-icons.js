#!/usr/bin/env node
/**
 * Generates the toolbar icons in two states:
 *   icons/{16,48,128}.png      ON  — the blue glyph and ring on transparent
 *   icons/{16,48,128}-off.png  OFF — the same artwork inverted: a solid blue
 *                                    disc with the ring and glyph knocked out
 *
 * The service worker swaps between the two from the "Convert pages" setting, so
 * the toolbar itself says whether Euspell is converting. Inverting rather than
 * greying keeps the badge legible at 16px — a desaturated version of a
 * single-colour mark reads as "blurry", not "off".
 *
 * Run: node build/gen-icons.js
 *
 * Source: Logo/Euspell3_medium.svg (circular-badge design, doubled ring + centered glyph).
 * Requires: npm install sharp (devDependency)
 */

import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url);
const SVG_SRC = new URL('../Logo/Euspell3_medium.svg', ROOT);
const ICONS_DIR = new URL('icons/', ROOT);

mkdirSync(fileURLToPath(ICONS_DIR), { recursive: true });

const svg = readFileSync(fileURLToPath(SVG_SRC), 'utf8');

// The artwork is one colour throughout (fill on the group, stroke on the ring
// path), which is what makes a clean inversion possible.
const BLUE = '#0000ff';

/**
 * The inverted artwork: a blue disc behind the mark, with the mark itself
 * recoloured to the page background so it reads as knocked out of the disc.
 *
 * The disc is drawn in viewBox units and inserted BEFORE the <g>, so it is not
 * subject to that group's flipping transform. The viewBox is 600x599, and the
 * ring very nearly fills it, so the disc is sized to just contain the ring.
 */
function invert(source) {
  const disc = `<circle cx="300" cy="299.5" r="299.5" fill="${BLUE}"/>`;
  // Matched off BLUE rather than a repeated literal: the guard below turns a
  // recoloured source into a build failure, but only if these stay in step.
  return source
    .replaceAll(`fill="${BLUE}"`, 'fill="#ffffff"')
    .replaceAll(`stroke="${BLUE}"`, 'stroke="#ffffff"')
    .replace(/(<g\s+transform)/, `${disc}$1`);
}

const invertedSvg = invert(svg);
if (invertedSvg === svg || !invertedSvg.includes('<circle')) {
  throw new Error('gen-icons: the SVG did not match the expected shape — inversion produced no change');
}

const sizes = [16, 48, 128];
const variants = [
  { suffix: '', markup: svg },
  { suffix: '-off', markup: invertedSvg },
];

await Promise.all(
  variants.flatMap(({ suffix, markup }) =>
    sizes.map(async (size) => {
      const name = `icons/${size}${suffix}.png`;
      await sharp(Buffer.from(markup)).resize(size, size).png().toFile(fileURLToPath(new URL(name, ROOT)));
      console.log(`[euspell-build] ${name}`);
    }),
  ),
);
