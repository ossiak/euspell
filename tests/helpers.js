// Shared test helpers.

/** Build a token. `tag` is a CLAWS7 tag string ('' for the target word). */
export const t = (word, tag = '', breakAfter = false) => ({ word, tag, breakAfter });

/**
 * Build a token array from `[word, tag]` pairs and return { tokens, idx } where
 * idx points at the first pair whose word matches `target` (case-insensitive).
 */
export function sentence(pairs, target) {
  const tokens = pairs.map(([w, tag]) => t(w, tag || ''));
  const idx = pairs.findIndex(([w]) => w.toLowerCase() === target.toLowerCase());
  return { tokens, idx };
}

/** Treat the literal "[]" placeholder (and empty) as zero euspellings. */
export function euspellings(field) {
  const f = (field || '').trim();
  if (f === '' || f === '[]') return [];
  return f.split('|').filter(Boolean);
}

/** Read and parse the lexicon CSV into {word,pos,encoding,spellings} rows.
 * `url` must be a resolved file URL (e.g. new URL('../data/x.csv', import.meta.url)). */
export function readLexicon(fs, url) {
  const text = fs.readFileSync(url, 'utf8');
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const c = line.split(',');
    if (c[2] === 'Encoding' || Number.isNaN(+c[2])) continue; // header
    out.push({ word: c[0], pos: c[1].split('|'), encoding: +c[2], spellings: euspellings(c[3]), raw: c[3] });
  }
  return out;
}
