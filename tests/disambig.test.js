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
  assert.equal(conv([['the', 'AT'], ['mucosa', 'NN1'], ['sloughs', ''], ['off', 'RP']], 'sloughs'), 'sluffz');
});

test('light-verb stubs (202): verb-default, noun on a noun-phrase cue', () => {
  // verb reading is the default for these high-frequency intransitives
  assert.equal(conv([['she', 'PPHS1'], ['looks', ''], ['tired', 'JJ']], 'looks'), 'lookz');
  assert.equal(conv([['he', 'PPHS1'], ['wants', ''], ['it', 'PPH1']], 'wants'), 'wantz');
  assert.equal(conv([['that', 'DD1'], ['sounds', ''], ['good', 'JJ']], 'sounds'), 'soundz');
  assert.equal(conv([['it', 'PPH1'], ['means', ''], ['nothing', 'PN1']], 'means'), 'meanz');
  // noun reading only on a clear noun-phrase cue before the target
  assert.equal(conv([['her', 'APPGE'], ['looks', ''], ['faded', 'VVD']], 'looks'), 'looks');
  assert.equal(conv([['good', 'JJ'], ['looks', ''], ['fade', 'VV0']], 'looks'), 'looks');
  assert.equal(conv([['his', 'APPGE'], ['wants', ''], ['and', 'CC']], 'wants'), 'wants');
  assert.equal(conv([['strange', 'JJ'], ['sounds', ''], ['echoed', 'VVD']], 'sounds'), 'sounds');
  // "means" idioms: "by means of" (II32 after a preposition), "the means"
  assert.equal(conv([['by', 'II31'], ['means', 'II32'], ['of', 'II33']], 'means'), 'means');
  assert.equal(conv([['the', 'AT'], ['means', ''], ['justify', 'VV0']], 'means'), 'means');
});

test('two-way semantic words (tear, wound)', () => {
  assert.equal(conv([['a', 'AT1'], ['tear', ''], ['rolled', 'VVD'], ['down', 'RP']], 'tear'), 'tear');   // teardrop
  assert.equal(conv([['a', 'AT1'], ['ragged', 'JJ'], ['tear', ''], ['in', 'II'], ['the', 'AT'], ['cloth', 'NN1']], 'tear'), 'taer'); // rip
});

// --- Every rule's declared spellings must still exist in the lexicon. --------
// route() maps a rule's return value back through spellings.indexOf() and falls
// back to index 0 on -1, so a rule that returns a spelling the lexicon no longer
// has fails SILENTLY — the branch just stops being reachable. barred.js sat that
// way after 3b861e7 renamed its spelling ('barrd' -> 'barrd'), and nothing
// caught it: 23 of the 70 semantic words have no corpus file, so the smoke test
// below never ran for them.
//
// Every rule documents its outputs as a @returns union, so that contract is what
// gets pinned. Checking the JSDoc rather than executing the rule covers branches
// no test input happens to reach.
test('every semantic rule\'s declared @returns spellings exist in the lexicon', () => {
  const ruleDir = new URL('../src/disambig/semantic/', import.meta.url);
  const bad = [];
  for (const file of fs.readdirSync(ruleDir)) {
    if (!file.endsWith('.js') || file === 'index.js') continue;
    const word = file.replace(/\.js$/, '');
    const entry = lexicon.get(word);
    if (!entry || !entry.spellings.length) continue; // shared helper, not a word rule
    const src = fs.readFileSync(new URL(file, ruleDir), 'utf8');
    const declared = new Set();
    for (const m of src.matchAll(/@returns\s*\{([^}]*)\}/g)) {
      for (const part of m[1].split('|')) {
        const s = part.trim().replace(/^['"]|['"]$/g, '');
        if (s && s !== 'null' && s !== 'string' && !/[A-Z[\]<>]/.test(s)) declared.add(s);
      }
    }
    if (!declared.size) continue;
    for (const d of declared) {
      if (!entry.spellings.includes(d)) bad.push(`${file}: declares '${d}', lexicon has {${entry.spellings.join('|')}}`);
    }
    for (const s of entry.spellings) {
      if (!declared.has(s)) bad.push(`${file}: lexicon has '${s}', never declared — unreachable`);
    }
  }
  assert.deepEqual(bad, []);
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
