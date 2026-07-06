#!/usr/bin/env node
/**
 * Generates icons/16.png, icons/48.png, icons/128.png from the SVG source.
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

const svgBuffer = readFileSync(fileURLToPath(SVG_SRC));

const sizes = [16, 48, 128];

await Promise.all(
  sizes.map(async (size) => {
    const outPath = fileURLToPath(new URL(`icons/${size}.png`, ROOT));
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
    console.log(`[euspell-build] icons/${size}.png`);
  }),
);
