/**
 * Builds disambig/debouches.txt from the three labelled source corpora, one per
 * reading — 100 sentences each, 300 in all.
 *
 * The debooshehs source is written with accents (débouchés). Written that way
 * the word never reaches the semantic rule at all: euspell_lexicon_accents.csv
 * bridges it and pins debooshehs, and all 100 resolve that way without
 * consulting the rule. So the fixture de-accents the target to the lexicon
 * headword `debouches`, which is the form the rule actually has to decide.
 *
 * Tags come from the project's own lexical tagger, so each token carries the
 * pipe-joined candidate set the runtime sees ('NN2|VVZ') rather than the single
 * gold CLAWS tag the older corpora were excerpted with. Punctuation is split
 * into its own token, as in those corpora.
 *
 * The corpus smoke test in tests/disambig.test.js checks only that every token
 * yields a *valid* spelling, not the right one. The per-reading accuracy is
 * what the gold labels are for; see the scoreboard in debouches.js.
 *
 * Usage:  node build/gen-debouches-corpus.mjs
 */
import fs from 'node:fs';
import { tagWord } from '../src/content/tagger.js';

const SOURCES = ['debooshehs', 'debouqhes', 'debouqhez']
  .map((reading) => [reading, `build/debouches-corpus-${reading}.txt`]);
const OUT = 'disambig/debouches.txt';

const deaccent = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');

function tag(line) {
  const toks = [];
  for (const raw of line.split(/\s+/)) {
    // Peel leading and trailing punctuation into tokens of their own.
    const [, lead, core, trail] = raw.match(/^([("'“‘]*)(.*?)([)"'”’.,;:!?]*)$/u);
    if (lead) for (const c of lead) toks.push(`${c}_${c}`);
    if (core) {
      // Only the target is de-accented: it must match the lexicon headword.
      const word = /d[ée]bouch[ée]s/i.test(core) ? deaccent(core) : core;
      toks.push(`${word}_${tagWord(word) || 'XX'}`);
    }
    if (trail) for (const c of trail) toks.push(`${c}_${c}`);
  }
  return toks.join(' ');
}

const out = [];
for (const [reading, path] of SOURCES) {
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+\.\s*/, '').trim())
    .filter(Boolean);
  const tagged = lines.map(tag);
  const targets = tagged.filter((l) => /\bdebouches_/.test(l)).length;
  console.log(`  ${reading}: ${lines.length} sentences, ${targets} targets`);
  out.push(...tagged);
}

fs.writeFileSync(OUT, `${out.join('\n')}\n`, 'utf8');
console.log(`${OUT}: ${out.length} sentences`);
