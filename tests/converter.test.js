import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/content/converter.js';
import { tagWord } from '../src/content/tagger.js';
import { t, sentence } from './helpers.js';

/**
 * Convert the target word in a `[word, tag]` sentence. Context words are tagged
 * by tagWord (the full lexicon candidate set), exactly as the runtime does —
 * the hand-written tags in each pair are ignored for context, so a test can't
 * accidentally feed a single tag where production sees a ditto-tag set (e.g.
 * "the" is AT|AT1|II42|JJ43|RR22|… , not bare AT). The target word is left
 * untagged, as it is when convert() is called.
 */
function conv(pairs, target) {
  const { tokens, idx } = sentence(pairs, target);
  for (let i = 0; i < tokens.length; i++) {
    tokens[i] = t(tokens[i].word, i === idx ? '' : tagWord(tokens[i].word));
  }
  return convert(tokens[idx].word, tokens, idx);
}

test('encoding 0 (unchanged) returns the word as-is', () => {
  assert.equal(conv([['cat', 'NN1']], 'cat'), 'cat');
  assert.equal(conv([['the', 'AT']], 'the'), 'the');
  assert.equal(conv([['run', 'VV0']], 'run'), 'run');
});

test('abbreviations (encoding 0 with an expansion field) are not replaced', () => {
  assert.equal(conv([['dr', 'NNB']], 'dr'), 'dr');
});

test('encoding %10==1 applies the single spelling', () => {
  assert.equal(conv([['they', 'PPHS2'], ['aahed', 'VVD']], 'aahed'), 'aahd');
});

test('012 NN2|VVZ diatone: noun vs verb', () => {
  assert.equal(conv([['two', 'MC'], ['records', 'NN2'], ['exist', 'VV0']], 'records'), 'records');
  assert.equal(conv([['she', 'PPHS1'], ['records', ''], ['the', 'AT'], ['song', 'NN1']], 'records'), 'recordz');
});

test('112 NN2|VVZ (stem respelled): noun vs verb', () => {
  assert.equal(conv([['the', 'AT'], ['anchors', 'NN2'], ['of', 'IO'], ['ships', 'NN2']], 'anchors'), 'ancors');
  assert.equal(conv([['he', 'PPHS1'], ['anchors', ''], ['the', 'AT'], ['boat', 'NN1']], 'anchors'), 'ancorz');
});

test('012 gap shape (NN|NN2|VVZ): the verb form is still reachable', () => {
  assert.equal(conv([['she', 'PPHS1'], ['aids', ''], ['him', 'PPHO1']], 'aids'), 'aidz');
  assert.equal(conv([['first', 'MD'], ['aids', 'NN2']], 'aids'), 'aids');
});

test('102 POS heteronym (use): noun vs verb', () => {
  assert.equal(conv([['the', 'AT'], ['use', 'NN1'], ['of', 'IO'], ['force', 'NN1']], 'use'), 'use');
  assert.equal(conv([['they', 'PPHS2'], ['use', ''], ['it', 'PPH1']], 'use'), 'uze');
});

test('702 French sg/pl (chassis): singular vs plural', () => {
  assert.equal(conv([['a', 'AT1'], ['chassis', 'NN1']], 'chassis'), 'shassi');
  assert.equal(conv([['two', 'MC'], ['chassis', 'NN2']], 'chassis'), 'shassis');
});

test('022 -ed adj/verb (blessed): verb vs adjective', () => {
  assert.equal(conv([['she', 'PPHS1'], ['blessed', ''], ['him', 'PPHO1']], 'blessed'), 'blessd');
  assert.equal(conv([['the', 'AT'], ['blessed', ''], ['event', 'NN1']], 'blessed'), 'blessed');
});

test('202 semantic (wind): two senses', () => {
  assert.equal(conv([['the', 'AT'], ['wind', 'NN1'], ['blew', 'VVD']], 'wind'), 'wind');
  assert.equal(conv([['wind', ''], ['the', 'AT'], ['clock', 'NN1']], 'wind'), 'wynd');
});

test('KEEP_UNCHANGED words pass through unchanged', () => {
  assert.equal(conv([['Bach', 'NP1'], ['wrote', 'VVD']], 'Bach'), 'Bach');
  assert.equal(conv([['sigma', 'NP1'], ['chis', 'NN2']], 'chis'), 'chis');
  assert.equal(conv([['the', 'AT'], ['ravined', 'JJ'], ['slope', 'NN1']], 'ravined'), 'ravined');
});

test('twinges resolves both ways (regression for the missing-noun-spelling fix)', () => {
  assert.equal(conv([['sharp', 'JJ'], ['twinges', 'NN2'], ['of', 'IO'], ['pain', 'NN1']], 'twinges'), 'twinges');
  assert.equal(conv([['it', 'PPH1'], ['twinges', ''], ['sharply', 'RR']], 'twinges'), 'twingez');
});

test('"is" reforms to "iz" (single spelling), preserving case', () => {
  assert.equal(conv([['this', 'DD1'], ['is', ''], ['a', 'AT1'], ['test', 'NN1']], 'is'), 'iz');
  assert.equal(conv([['Is', ''], ['it', 'PPH1'], ['here', 'RL']], 'Is'), 'Iz');
});

test('the pronoun I reforms to ih, capitalized only at sentence start', () => {
  assert.equal(convert('I', [t('I', '')], 0), 'Ih');
  assert.equal(convert('I', [t('and', 'CC'), t('I', '')], 1), 'ih');
});

test('contractions of the pronoun I follow the same sentence-position case', () => {
  // mid-sentence (idx 1, no break before) → lowercase; sentence start → capital.
  for (const [w, mid, start] of [
    ["I've", "ih'v", "Ih'v"],
    ["I'm", "ih'm", "Ih'm"],
    ["I’m", "ih'm", "Ih'm"], // curly apostrophe resolves the same
    ['Imma', 'ihma', 'Ihma'],
  ]) {
    assert.equal(convert(w, [t('so', 'RR'), t(w, '')], 1), mid, `${w} mid-sentence`);
    assert.equal(convert(w, [t(w, '')], 0), start, `${w} at sentence start`);
  }
});

test('a capitalized non-pronoun that reforms to ih… keeps its capital', () => {
  // "Island" → "Ihland"; the decapitalization is gated on the pronoun (PPIS1),
  // not on the "ih" spelling, so a proper noun mid-sentence is untouched.
  assert.equal(convert('Island', [t('the', 'AT'), t('Island', 'NP1')], 1), 'Ihland');
});

test('capitalization of the source word is preserved', () => {
  assert.equal(conv([['Wind', ''], ['the', 'AT'], ['clock', 'NN1']], 'Wind'), 'Wynd');
});
