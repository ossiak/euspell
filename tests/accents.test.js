// Accented spellings convert. Until 1 Sep 2026 they did not: data/euspell_
// lexicon_accents.csv existed and nothing read it, so `façade` reached the
// converter, missed a lexicon keyed on ASCII, and came out unchanged. The fix
// resolves the bridge at compile time — build/lib/accents.js appends the
// accented forms to the compiled Map as alias keys — so these tests exercise the
// ordinary converter path with no accent-specific code in it at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { convert } from '../src/content/converter.js';
import { tagWord } from '../src/content/tagger.js';
import { data as lexicon } from '../dist/lexicon.js';
import { t, sentence } from './helpers.js';

function conv(pairs, target) {
  const { tokens, idx } = sentence(pairs, target);
  for (let i = 0; i < tokens.length; i++) {
    tokens[i] = t(tokens[i].word, i === idx ? '' : tagWord(tokens[i].word));
  }
  return convert(tokens[idx].word, tokens, idx);
}

/** The bridge file, as [accented, headword, pin] rows. */
function accentRows() {
  const text = fs.readFileSync(new URL('../data/euspell_lexicon_accents.csv', import.meta.url), 'utf8');
  return text.split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(','));
}

test('the bridge file is well formed: three fields on every row', () => {
  // `limaçon,limacon` and `limaçons,limacons` were added by hand with two
  // fields, which csv-parse refuses in `columns: true` mode — the build failed
  // outright the moment anything parsed the file properly. Both are generated
  // now; this asserts nobody hand-adds a third.
  const text = fs.readFileSync(new URL('../data/euspell_lexicon_accents.csv', import.meta.url), 'utf8');
  const bad = text.split(/\r?\n/).filter((l) => l.trim() && l.split(',').length !== 3);
  assert.deepEqual(bad, [], 'every row needs Accented,Word,euspelling');
});

test('every accented spelling is a key in the compiled lexicon', () => {
  const missing = accentRows().map(([a]) => a).filter((a) => !lexicon.has(a));
  assert.deepEqual(missing, [], 'accent aliases missing from dist/lexicon.js');
});

test('an accented word converts through its headword', () => {
  assert.equal(conv([['the', 'AT'], ['façade', 'NN1']], 'façade'), 'fasade');
  assert.equal(conv([['a', 'AT1'], ['garçon', 'NN1']], 'garçon'), 'garson');
  assert.equal(conv([['a', 'AT1'], ['soupçon', 'NN1']], 'soupçon'), 'soupson');
  assert.equal(conv([['an', 'AT1'], ['aperçu', 'NN1']], 'aperçu'), 'apersu');
  assert.equal(conv([['the', 'AT'], ['café', 'NN1']], 'café'), 'cafeh');
  assert.equal(conv([['a', 'AT1'], ['crèche', 'NN1']], 'crèche'), 'cresh');
});

test('the ligature is bridged too — NFD alone would miss it', () => {
  // `œ` carries no combining mark, so a de-accenting rule built on unicodedata
  // never touches it. It is a row in the map for exactly that reason. `boeuf`
  // is 700 (unchanged, French pronunciation), so the accented form must come
  // back unchanged rather than not come back at all.
  assert.equal(conv([['the', 'AT'], ['bœuf', 'NN1']], 'bœuf'), 'bœuf');
});

test('case is taken from the accented source', () => {
  assert.equal(conv([['façade', 'NN1']], 'façade'), 'fasade');
  assert.equal(conv([['Façade', 'NN1']], 'Façade'), 'Fasade');
  assert.equal(conv([['FAÇADE', 'NN1']], 'FAÇADE'), 'FASADE');
  // A word whose FIRST letter carries the accent. matchCase asks whether
  // `original[0] === original[0].toUpperCase()`, and that has to be answered
  // about é/É rather than about a de-accented stand-in.
  assert.equal(conv([['émigré', 'NN1']], 'émigré'), 'emigreh');
  assert.equal(conv([['Émigré', 'NN1']], 'Émigré'), 'Emigreh');
  assert.equal(conv([['ÉMIGRÉ', 'NN1']], 'ÉMIGRÉ'), 'EMIGREH');
});

test('a headword the reform leaves alone leaves the accented form alone', () => {
  // 700: unchanged, French pronunciation. The bridge must not invent a spelling.
  for (const w of ['gâteau', 'régime', 'réseau', 'solfège']) {
    assert.equal(conv([['the', 'AT'], [w, 'NN1']], w), w);
  }
});

test('a pinned row takes the reading the accent settles', () => {
  // `attaches` is 112 — plural noun `attashehs` or third-person verb `attaqhez`.
  // Written `attachés` it is the noun, whatever the context looks like, so the
  // pin must beat the noun/verb rule in both directions.
  assert.equal(conv([['the', 'AT'], ['attachés', 'NN2'], ['met', 'VVD']], 'attachés'), 'attashehs');
  assert.equal(conv([['he', 'PPHS1'], ['attachés', 'VVZ'], ['it', 'PPH1']], 'attachés'), 'attashehs');
  // `debouches` is 113 and carries a semantic rule keyed on the ASCII spelling;
  // the accented form is the French noun plural and never reaches that rule.
  assert.equal(conv([['the', 'AT'], ['débouchés', 'NN2']], 'débouchés'), 'debooshehs');
  // `manque` is 702 -> manq|manqeh, and the accent picks the second, not the first.
  assert.equal(conv([['a', 'AT1'], ['manqué', 'NN1']], 'manqué'), 'manqeh');
});

test('an unpinned split still reads its context, exactly as the ASCII form does', () => {
  // `echelons` is 112. The accent is not evidence of a noun — *he flambés the
  // dish* is written with it — so these inherit the choice rather than pinning
  // it, and must track whatever the ASCII form does in the same sentence.
  const noun = [['the', 'AT'], ['échelons', 'NN2'], ['of', 'IO'], ['power', 'NN1']];
  const verb = [['he', 'PPHS1'], ['échelons', 'VVZ'], ['the', 'AT'], ['units', 'NN2']];
  const asciiNoun = [['the', 'AT'], ['echelons', 'NN2'], ['of', 'IO'], ['power', 'NN1']];
  const asciiVerb = [['he', 'PPHS1'], ['echelons', 'VVZ'], ['the', 'AT'], ['units', 'NN2']];
  assert.equal(conv(noun, 'échelons'), conv(asciiNoun, 'echelons'));
  assert.equal(conv(verb, 'échelons'), conv(asciiVerb, 'echelons'));
  // And the two readings are actually different, or the assertions above are vacuous.
  assert.notEqual(conv(asciiNoun, 'echelons'), conv(asciiVerb, 'echelons'));
});

test('an alias never shadows a real lexicon word', () => {
  // The compiler refuses this, but the refusal is only as good as the data it
  // sees; assert it against the shipped map too.
  const csvWords = new Set(
    fs.readFileSync(new URL('../data/euspell_lexicon.csv', import.meta.url), 'utf8')
      .split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.slice(0, l.indexOf(','))),
  );
  const shadowed = accentRows().map(([a]) => a).filter((a) => csvWords.has(a));
  assert.deepEqual(shadowed, [], 'an accented key collides with a real headword');
});
