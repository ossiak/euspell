#!/usr/bin/env node
/**
 * Scans the lexicon for entries with encoding >= 200 (disambiguation required)
 * and generates skeleton function stubs in src/disambig/pos.js.
 *
 * Run: node build/gen-disambig.js
 *
 * Only generates stubs for functions not already present — safe to re-run.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const ROOT = new URL('..', import.meta.url);
const LEXICON = new URL('data/euspell_lexicon.csv', ROOT);
const OUT = new URL('src/disambig/pos.js', ROOT);

const rows = parse(readFileSync(fileURLToPath(LEXICON), 'utf8'), {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const ambiguous = rows.filter((r) => parseInt(r.Encoding, 10) >= 200);
console.log(`[euspell-build] Found ${ambiguous.length} entries requiring disambiguation`);

const existing = existsSync(fileURLToPath(OUT)) ? readFileSync(fileURLToPath(OUT), 'utf8') : '';

const stubs = ambiguous
  .map((row) => {
    const pos = row.PoS.split('|');
    const spellings = row.euspelling === '[]' ? [] : row.euspelling.split('|');
    const fnName = `disambig_${row.Word.replace(/[^a-zA-Z0-9]/g, '_')}`;

    if (existing.includes(`function ${fnName}`)) return null;

    const spellingMap = pos
      .map((tag, i) => `//   ${tag} → '${spellings[i] ?? row.Word}'`)
      .join('\n');

    return `
/**
 * Disambiguates '${row.Word}' (encoding ${row.Encoding}).
${spellingMap}
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {string}
 */
export function ${fnName}(tokens, idx) {
  // TODO: implement
  return '${spellings[0] ?? row.Word}';
}`;
  })
  .filter(Boolean);

if (stubs.length === 0) {
  console.log('[euspell-build] No new stubs to add.');
} else {
  const header = existing || `// Auto-generated stubs — implement each function body\n// Re-run gen-disambig.js to add new stubs without overwriting existing ones\n\n/**\n * @typedef {{ word: string, tag: string }} Token\n */\n`;
  writeFileSync(fileURLToPath(OUT), header + stubs.join('\n'), 'utf8');
  console.log(`[euspell-build] Added ${stubs.length} stubs to src/disambig/pos.js`);
}
