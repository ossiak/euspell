import { test } from 'node:test';
import assert from 'node:assert/strict';
import { texGeneric, nameBold, nameBlack, nameItalic } from '../src/pdf/font-style.js';

// Every name below was read out of one of the two California workers'-compensation
// PDFs this was reported against, via page.commonObjs. In both files pdf.js
// reported bold/italic/black as `undefined` for EVERY face, so these names are
// the only signal the viewer has.

test('italic and oblique faces are recognised by name', () => {
  for (const n of [
    'RWEKDL+Calibri-Italic', 'QTEYGX+Calibri,Italic', 'CUSDBP+Calibri-BoldItalic',
    'TLHIBH+Calibri,BoldItalic', 'HWHMTF+Calibri-LightItalic',
    'ZSSHWU+CenturyGothic,BoldItalic', 'Helvetica-Oblique',
  ]) {
    assert.equal(nameItalic(n), true, `${n} is italic`);
  }
});

test('upright faces are not mistaken for italic', () => {
  for (const n of [
    'MXJWLV+Calibri', 'JESVLW+Calibri-Bold', 'HTNWTF+Calibri-Light',
    'DHQQTB+AcuminPro-Black', 'GFUIJV+HalyardDisplayMedium', 'RYDCUL+CMBX12',
  ]) {
    assert.equal(nameItalic(n), false, `${n} is upright`);
  }
});

test('black/heavy faces are recognised, and outrank bold', () => {
  // AcuminPro-Black sets the headline of the CDI guide; it has no "bold" in its
  // name, so before this it drew as normal weight.
  assert.equal(nameBlack('DHQQTB+AcuminPro-Black'), true);
  assert.equal(nameBold('DHQQTB+AcuminPro-Black'), false);
  for (const n of ['Roboto-Heavy', 'Inter-ExtraBold', 'Foo-UltraBold']) {
    assert.equal(nameBlack(n), true, `${n} is black-weight`);
  }
});

test('"ultra"/"extra" alone do not imply weight', () => {
  // UltraLight is the opposite of heavy — matching a bare "ultra" would invert it.
  assert.equal(nameBlack('Helvetica-UltraLight'), false);
  assert.equal(nameBold('Helvetica-UltraLight'), false);
});

test('bold faces are recognised by name, including TeX conventions', () => {
  for (const n of [
    'JESVLW+Calibri-Bold', 'ATYYVT+Calibri,Bold', 'GFUIJV+HalyardDisplaySemiBold',
    'DHQQTB+AcuminProCond-Bold', 'RYDCUL+CMBX12', 'LMSSBX10',
  ]) {
    assert.equal(nameBold(n), true, `${n} is bold`);
  }
  for (const n of ['MXJWLV+Calibri', 'RXBVAP+Calibri-Light', 'CMR12', 'cmss10']) {
    assert.equal(nameBold(n), false, `${n} is not bold`);
  }
});

test('texGeneric reads the TeX family conventions', () => {
  assert.equal(texGeneric('RYDCUL+CMBX12'), 'serif');
  assert.equal(texGeneric('CMR12'), 'serif');
  assert.equal(texGeneric('cmss10'), 'sans-serif');
  assert.equal(texGeneric('CMTT10'), 'monospace');
  assert.equal(texGeneric('lmmono10'), 'monospace');
  // An unrecognised family keeps pdf.js's own guess.
  assert.equal(texGeneric('MXJWLV+Calibri'), null);
  assert.equal(texGeneric(''), null);
});
