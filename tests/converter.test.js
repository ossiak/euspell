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

test('152 POS heteronym, non -ate (use): noun vs verb', () => {
  assert.equal(conv([['the', 'AT'], ['use', 'NN1'], ['of', 'IO'], ['force', 'NN1']], 'use'), 'use');
  assert.equal(conv([['they', 'PPHS2'], ['use', ''], ['it', 'PPH1']], 'use'), 'uze');
});

test("the clitic 's: a determiner after a participle is not an attributive noun", () => {
  // Regression: the attributive test used a loose prefix check, so "a"
  // (AT1|…|NN132 — a stray ditto tag) counted as the following NOUN and made
  // "the author's published a book" a genitive. Both arms of that test RETURN,
  // so one spurious ditto match flips the answer outright.
  assert.equal(conv([['the', ''], ['author', ''], ["'s", ''], ['published', ''], ['a', ''], ['book', '']], "'s"), "'z");
  // Still a genitive where a real noun follows the participle (attributive).
  assert.equal(conv([['the', ''], ['author', ''], ["'s", ''], ['published', ''], ['works', '']], "'s"), "'s");
  assert.equal(conv([['today', ''], ["'s", ''], ['featured', ''], ['article', '']], "'s"), "'s");
  assert.equal(conv([['the', ''], ['cat', ''], ["'s", ''], ['tail', '']], "'s"), "'s");
});

test("whole-word possessive contractions route the clitic like the bare 's", () => {
  // Regression: anyone's/everyone's/someone's/somebody's/nobody's reach route()
  // with pos ["PN1 GE","PN1 VBZ","PN1 VHZ"], where the genitive marker GE is the
  // FINAL tag of a reading, not a bare tag — so a plain pos.includes('GE') missed
  // them and they always took spellings[0] (the genitive 's), never the 'z. Now
  // routed through is_verbal_s, to parity with the bare clitic above: a following
  // noun head is the genitive, a following participle/predicate the contracted verb.
  //
  // This covers route()'s DISPATCH only. The stream is hand-built, so the target
  // is one token — whereas the tokenizer gives a whole-word contraction one
  // pseudo-token per PoS position, which is the alignment the rule actually has to
  // read past. That gap hid a bug this test went on passing through: see "a
  // whole-word possessive contraction decides on its post-clitic context" in
  // dom-walker.test.js, which drives the same words through the real tokenizer.
  assert.equal(conv([["anyone's", ''], ['guess', 'NN1']], "anyone's"), "anywun's");   // genitive
  assert.equal(conv([["anyone's", ''], ['coming', 'VVG']], "anyone's"), "anywun'z");  // is/has
  assert.equal(conv([["someone's", ''], ['house', 'NN1']], "someone's"), "somwun's"); // genitive
  assert.equal(conv([["nobody's", ''], ['business', 'NN1']], "nobody's"), "nobody's");// genitive
  assert.equal(conv([["nobody's", ''], ['looking', 'VVG']], "nobody's"), "nobody'z"); // is/has
  assert.equal(conv([["everyone's", ''], ['ready', 'JJ']], "everyone's"), "evrywun'z");// predicate → is
  assert.equal(conv([["everyone's", ''], ['here', 'RL']], "everyone's"), "evrywun'z"); // locative → is
  assert.equal(conv([["someone's", ''], ['there', 'EX']], "someone's"), "somwun'z");   // existential → is
});

test('a determiner before a heteronym settles the noun reading', () => {
  // Regression: the adverb look-through used a loose prefix test, so "the"
  // (AT|…|RG42|RR22|RT42 — stray ditto-adverb tags) was mistaken for an adverb
  // and skipped, discarding the determiner cue entirely. "the live broadcast"
  // then reformed as the verb. Only a word that can EXCLUSIVELY be an adverb
  // may be looked through.
  assert.equal(conv([['the', ''], ['live', ''], ['broadcast', '']], 'live'), 'live');
  assert.equal(conv([['a', ''], ['live', ''], ['wire', '']], 'live'), 'live');
  assert.equal(conv([['the', ''], ['refuse', ''], ['collection', '']], 'refuse'), 'refuse');
});

test('a verb-dominant heteronym defaults to the verb when context is silent', () => {
  // With no cue either way the vote is 0; a word in VV0_VERB_DEFAULT (live is
  // ~87% verb in the corpus) takes the verb reading rather than the global
  // noun-first default. Context still wins wherever it has an opinion — see the
  // determiner test above.
  assert.equal(conv([['they', ''], ['live', ''], ['here', '']], 'live'), 'liv');
  // "refuse" was pinned here too until the -fuse family stopped being respelled.
  // It is a genuine heteronym — /ˈrɛfjuːs/ the rubbish against /rɪˈfjuːz/ the
  // verb — but with both readings now spelled "refuse" there is nothing for the
  // default to choose between, and gen-vv0-prior.mjs drops any word that is not
  // encoding 152. Restore the row and the set regenerates with it.
  assert.equal(conv([['they', ''], ['reuse', ''], ['it', '']], 'reuse'), 'reuze');
  // "use" is NOT in the set — its context rule already beats its base rate — so
  // it keeps the noun-first default and both readings still resolve by context.
  assert.equal(conv([['the', ''], ['use', ''], ['of', ''], ['force', '']], 'use'), 'use');
  assert.equal(conv([['we', ''], ['use', ''], ['it', '']], 'use'), 'uze');
});

test('102 POS heteronym, -ate stress pair (separate): adjective vs verb', () => {
  // The two heteronym encodings were split (150 "-ate" pairs stay 102, the 19
  // others became 152); both must still reach is_verb_VV0.
  assert.equal(conv([['two', 'MC'], ['separate', 'JJ'], ['rooms', 'NN2']], 'separate'), 'separat');
  assert.equal(conv([['they', 'PPHS2'], ['separate', ''], ['the', 'AT'], ['eggs', 'NN2']], 'separate'), 'separate');
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
