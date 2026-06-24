import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { convert } from '../src/content/converter.js';
import { SEMANTIC } from '../src/disambig/semantic/index.js';
import { data as lexicon } from '../dist/lexicon.js';
import { t, sentence } from './helpers.js';

function conv(pairs, target) {
  const { tokens, idx } = sentence(pairs, target);
  tokens[idx] = t(tokens[idx].word, '');
  return convert(tokens[idx].word, tokens, idx);
}

test('bows: four-way (vowel x noun/verb)', () => {
  assert.equal(conv([['carried', 'VVD'], ['bows', ''], ['and', 'CC'], ['arrows', 'NN2']], 'bows'), 'bows');   // /boU/ noun
  assert.equal(conv([['a', 'AT1'], ['shot', 'NN1'], ['across', 'II'], ['their', 'APPGE'], ['bows', '']], 'bows'), 'buws'); // /baU/ noun
  assert.equal(conv([['he', 'PPHS1'], ['bows', ''], ['to', 'II'], ['the', 'AT'], ['crowd', 'NN1']], 'bows'), 'buwz'); // /baU/ verb
});

test('tears: four-way (teardrop vs rip)', () => {
  assert.equal(conv([['her', 'APPGE'], ['eyes', 'NN2'], ['filled', 'VVD'], ['with', 'IW'], ['tears', '']], 'tears'), 'tears'); // /tIr/ noun
  assert.equal(conv([['he', 'PPHS1'], ['tears', ''], ['the', 'AT'], ['envelope', 'NN1'], ['open', 'JJ']], 'tears'), 'taerz'); // /tEr/ verb
});

test('rows: four-way (line/boat vs quarrel)', () => {
  assert.equal(conv([['rows', ''], ['of', 'IO'], ['seats', 'NN2']], 'rows'), 'rows');               // /roU/ noun
  assert.equal(conv([['blazing', 'JJ'], ['rows', ''], ['about', 'II'], ['money', 'NN1']], 'rows'), 'ruws'); // /raU/ noun
});

test('sloughs: sense-first (mire/backwater/shed)', () => {
  assert.equal(conv([['falling', 'VVG'], ['into', 'II'], ['sloughs', ''], ['of', 'IO'], ['despond', 'NN1']], 'sloughs'), 'slouhs');
  assert.equal(conv([['channels', 'NN2'], ['sloughs', ''], ['and', 'CC'], ['levees', 'NN2']], 'sloughs'), 'sluhs');
  assert.equal(conv([['the', 'AT'], ['mucosa', 'NN1'], ['sloughs', ''], ['off', 'RP']], 'sloughs'), 'sloffz');
});

test('two-way semantic words (tear, wound)', () => {
  assert.equal(conv([['a', 'AT1'], ['tear', ''], ['rolled', 'VVD'], ['down', 'RP']], 'tear'), 'tear');   // teardrop
  assert.equal(conv([['a', 'AT1'], ['ragged', 'JJ'], ['tear', ''], ['in', 'II'], ['the', 'AT'], ['cloth', 'NN1']], 'tear'), 'taer'); // rip
});

// --- Corpus smoke: every tagged token must resolve to a valid euspelling. ---
const dir = new URL('../disambig/', import.meta.url);
const corpora = fs.readdirSync(dir).filter((f) => f.endsWith('.txt'));
const clean = (w) => w.toLowerCase().replace(/[.,!?;:'"]+$/, '');

for (const file of corpora) {
  const word = file.replace(/\.txt$/, '');
  if (!SEMANTIC.has(word)) continue; // only files backed by a registered rule
  const entry = lexicon.get(word);
  if (!entry) continue;

  test(`corpus ${file}: every token yields a valid euspelling`, () => {
    const text = fs.readFileSync(new URL(file, dir), 'utf8');
    const valid = new Set(entry.spellings.map((s) => s.toLowerCase()));
    let checked = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!/_[A-Z]/.test(line)) continue;
      const toks = line.split(/\s+/).map((tk) => {
        const i = tk.lastIndexOf('_');
        return t(i > 0 ? tk.slice(0, i) : tk, i > 0 ? tk.slice(i + 1) : '');
      });
      for (let idx = 0; idx < toks.length; idx++) {
        if (clean(toks[idx].word) !== word) continue;
        const out = convert(word, toks, idx).toLowerCase();
        assert.ok(valid.has(out), `${file}: "${word}" -> "${out}" not in {${[...valid].join(',')}}`);
        checked++;
      }
    }
    assert.ok(checked > 0, `found at least one "${word}" token in ${file}`);
  });
}
