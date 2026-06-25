import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleColors } from '../src/pdf/sample-colors.js';

// Build a W×H RGBA buffer, filled with `bg`, with `marks` pixels overpainted.
function raster(W, H, bg, marks = []) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    d[i * 4] = bg[0]; d[i * 4 + 1] = bg[1]; d[i * 4 + 2] = bg[2]; d[i * 4 + 3] = 255;
  }
  for (const [x, y, c] of marks) {
    const i = (y * W + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return d;
}

test('sampleColors: black text on white -> black ink, white paper', () => {
  const d = raster(4, 4, [255, 255, 255], [[1, 1, [0, 0, 0]], [2, 2, [0, 0, 0]]]);
  assert.deepEqual(sampleColors(d, 4, 4, 0, 0, 4, 4), { ink: 'rgb(0, 0, 0)', paper: 'rgb(255, 255, 255)' });
});

test('sampleColors: coloured text on a coloured background is recovered', () => {
  const d = raster(4, 4, [200, 200, 200], [[1, 1, [255, 0, 0]], [2, 1, [255, 0, 0]]]);
  assert.deepEqual(sampleColors(d, 4, 4, 0, 0, 4, 4), { ink: 'rgb(255, 0, 0)', paper: 'rgb(200, 200, 200)' });
});

test('sampleColors: a flat box (no glyphs) keeps black ink on the fill colour', () => {
  const d = raster(4, 4, [123, 123, 123]);
  assert.deepEqual(sampleColors(d, 4, 4, 0, 0, 4, 4), { ink: 'rgb(0, 0, 0)', paper: 'rgb(123, 123, 123)' });
});

test('sampleColors: an out-of-bounds / empty box returns the defaults', () => {
  const d = raster(4, 4, [255, 255, 255]);
  assert.deepEqual(sampleColors(d, 4, 4, 10, 10, 4, 4), { ink: 'rgb(0, 0, 0)', paper: 'rgb(255, 255, 255)' });
});

test('sampleColors: the box is clipped to the canvas bounds', () => {
  // Box runs off the right/bottom edge; only the in-bounds region is sampled.
  const d = raster(4, 4, [255, 255, 255], [[3, 3, [0, 0, 0]]]);
  assert.deepEqual(sampleColors(d, 4, 4, 2, 2, 10, 10), { ink: 'rgb(0, 0, 0)', paper: 'rgb(255, 255, 255)' });
});
