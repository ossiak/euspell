// Print-layout regressions in src/pdf/viewer.css.
//
// Every fault guarded here shipped, and none of them was visible on screen: the
// viewer looked perfect and printed a one-page document onto three sheets, one
// blank before and one after. They are all "the rule is there but does not win"
// faults, which no amount of reading the block in isolation reveals — so they are
// asserted against the file text instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/pdf/viewer.css', import.meta.url), 'utf8');

/** Strip comments so a selector mentioned in prose is never mistaken for a rule. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The `@media print` block, located by counting braces from its opening one —
 * the block contains nested rules, so a non-greedy match to the first `}` would
 * stop inside it.
 * @returns {{ start: number, end: number, body: string }}
 */
function printBlock() {
  const bare = stripComments(css);
  const start = bare.indexOf('@media print');
  assert.notEqual(start, -1, 'viewer.css must have an @media print block');
  const open = bare.indexOf('{', start);
  let depth = 0;
  let i = open;
  for (; i < bare.length; i++) {
    if (bare[i] === '{') depth++;
    else if (bare[i] === '}' && --depth === 0) break;
  }
  assert.ok(i < bare.length && depth === 0, 'unbalanced braces after @media print');
  return { start, end: i + 1, body: bare.slice(open + 1, i) };
}

// THE one that caused the bug. The print rules use the same selectors as the
// screen rules (#pages, .textLayer), so they carry the same specificity and the
// later rule wins. With the block sitting above them, #pages kept display:flex
// and its 20px/60px padding *while printing*, and that 80px pushed every
// document onto an extra sheet. Nothing may follow the block.
test('the @media print block is the last rule in viewer.css', () => {
  const { end } = printBlock();
  const after = stripComments(css).slice(end).trim();
  assert.equal(
    after,
    '',
    `@media print must be last in viewer.css — a same-specificity rule after it\n` +
      `silently wins and the print layout reverts. Found after the block:\n${after.slice(0, 300)}`,
  );
});

// The zoom implementation writes width/height as INLINE styles on both the page
// wrapper and its canvas. Inline beats every stylesheet rule that is not
// !important, whatever the file order — so this pair cannot be fixed by moving
// the block, and dropping !important silently restores the on-screen pixel
// height (1264px at 100% zoom) onto a 1123px A4 sheet.
test('print sizing overrides the renderer\'s inline width/height', () => {
  const { body } = printBlock();
  for (const selector of ['#pages > div', '#pages canvas']) {
    const rule = body.match(
      new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
    );
    assert.ok(rule, `@media print must style ${selector}`);
    for (const prop of ['width', 'height']) {
      const m = rule[1].match(new RegExp(`(?<!max-)\\b${prop}\\s*:\\s*auto\\s*!important`));
      assert.ok(
        m,
        `${selector} needs ${prop}: auto !important in print — the renderer pins ` +
          `${prop} inline, and inline beats any rule without !important`,
      );
    }
  }
});

// Pages render lazily, so the last child of #pages is usually a placeholder that
// never rendered and that the :empty rule hides. A `break-after: page` reset
// scoped to :last-child therefore lands on a hidden element, leaving the forced
// break on the last *printed* page — a trailing blank sheet. Breaking BEFORE
// each page has no such edge: the fragmenter suppresses a forced break at the
// very start of the document.
test('pages break before, not after, so no :last-child reset is needed', () => {
  const { body } = printBlock();
  assert.match(body, /break-before\s*:\s*page/, 'print must force a break before each page');
  assert.doesNotMatch(
    body,
    /page-break-after\s*:\s*always/,
    'break-after + a :last-child reset is unsound here — the real last child is ' +
      'usually an unrendered placeholder hidden by the :empty rule, so the reset ' +
      'misses the last printed page and emits a trailing blank sheet',
  );
});

// The text layer is a transparent overlay carrying its own inline pixel size and
// absolutely positioned, so it keeps full size as the canvas scales down to the
// sheet. That overflow paginates into extra near-blank sheets, and none of it is
// visible on paper.
test('the transparent text layer is not printed', () => {
  const { body } = printBlock();
  const rule = body.match(/\.textLayer\s*\{([^}]*)\}/);
  assert.ok(rule, '@media print must hide .textLayer');
  assert.match(
    rule[1],
    /display\s*:\s*none/,
    '.textLayer must be display:none in print — it is invisible on paper and its ' +
      'inline pixel size overflows the scaled canvas onto extra sheets',
  );
});

// The screen layout centres pages in a flex column with 20px top and 60px bottom
// padding. Both have to be off for printing; the padding was worth 80px, which
// is one extra sheet per document on its own.
test('print resets the screen layout on #pages', () => {
  const { body } = printBlock();
  const rule = body.match(/#pages\s*\{([^}]*)\}/);
  assert.ok(rule, '@media print must reset #pages');
  assert.match(rule[1], /display\s*:\s*block/, '#pages must not stay a flex column in print');
  assert.match(rule[1], /padding\s*:\s*0/, '#pages padding must be zeroed — it is worth 80px');
});
