/**
 * Disambiguates 'tear': /tɛər/ (rhymes with "air" → 'taer' — the verb to rip,
 * and a rip/rent: "tear the paper", "a ragged tear", "wear and tear") vs /tɪər/
 * (rhymes with "ear" → 'tear' — the teardrop from crying, and "tear gas").
 * Corpus: disambig/tear.txt
 *
 * The rip verb and the rip noun are both /tɛər/ and together dominate, so 'taer'
 * is the unmarked default. The teardrop /tɪər/ ('tear') is taken on crying
 * evidence: a tear-motion verb after ("tear rolled/trickled/welled"), the heads
 * "tear gas/tracks/duct/drop", "tear of <emotion>", or eye/cheek/weeping
 * vocabulary beside a determined noun ("a tear in her eye"). The decision rests
 * only on neighbouring words, never the target's own NN1|VV0 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Right after a teardrop noun: a verb of a tear falling/forming ("a tear rolled
// down", "a tear welled up") — these never follow the rip verb "tear".
const TEARDROP_VERB = new Set([
  'rolled', 'rolling', 'ran', 'running', 'trickled', 'trickling', 'fell', 'falling',
  'slid', 'sliding', 'welled', 'welling', 'dropped', 'streaked', 'streaking',
  'coursed', 'coursing', 'streamed', 'streaming', 'slipped', 'slipping', 'glistened',
  'glistening', 'spilled', 'spilling', 'slicked', 'escaped', 'gathered', 'brimmed',
  'brimming', 'stung', 'blurred', 'sparkled', 'glinted', 'hung', 'hovered', 'dripped',
  'leaked', 'formed', 'forming', 'crept', 'wound',
]);
// Right after "tear": a head noun that fixes the /tɪər/ sense.
const TEARDROP_HEAD = new Set(['gas', 'tracks', 'track', 'duct', 'ducts', 'drop', 'drops', 'stains', 'stain', 'stained']);
// After "tear of": an emotion, giving "a tear of joy/sorrow".
const EMOTION = new Set([
  'joy', 'sorrow', 'grief', 'happiness', 'sadness', 'gratitude', 'relief', 'pity',
  'rage', 'frustration', 'laughter', 'sympathy', 'remorse', 'regret', 'anguish',
  'despair', 'pride', 'shame',
]);
// Crying vocabulary anywhere in the clause — present beside a determined "tear".
const CRYING_FIELD = new Set([
  'eye', 'eyes', 'eyelid', 'eyelids', 'cheek', 'cheeks', 'cry', 'cried', 'crying',
  'cries', 'weep', 'wept', 'weeping', 'weeps', 'sob', 'sobbed', 'sobbing', 'sobs',
  'shed', 'shedding', 'sheds', 'wipe', 'wiped', 'wiping', 'wipes', 'blink', 'blinked',
  'blinking', 'lashes', 'lash', 'sniff', 'sniffed', 'sniffled', 'weepy', 'misty',
  'tearful', 'sobs',
]);
// Determiners/adjectives that premodify a singular teardrop noun.
const TEARDROP_DET = new Set([
  'a', 'an', 'the', 'each', 'every', 'single', 'one', 'that', 'this', 'his', 'her',
  'my', 'your', 'their', 'its', 'no', 'first', 'another', 'some', 'lone', 'solitary',
  'silent', 'stray', 'hot', 'warm', 'salty', 'salt', 'fresh', 'big', 'last', 'lonely',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'taer' | 'tear'}
 */
export function disambiguate_tear(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  const next = wordOf(tokens[idx + 1]);

  // "tear gas/tracks/duct", or a tear-falling verb after — the teardrop /tɪər/.
  if (TEARDROP_HEAD.has(next)) return 'tear';
  if (TEARDROP_VERB.has(next)) return 'tear';
  // "a tear of joy/sorrow".
  if (next === 'of' && EMOTION.has(wordOf(tokens[idx + 2]))) return 'tear';

  // A noun "tear" beside crying vocabulary — the teardrop /tɪər/. Fires when it
  // is a determined noun ("a tear … cheek") or in the "tear in <eye>" frame
  // ("tear in her eyes"); "tear in the cloth" has no crying word, so it stays a
  // rip.
  if (TEARDROP_DET.has(prev) || next === 'in') {
    for (let j = idx - 3; j <= idx + 4; j++) {
      if (j !== idx && tokens[j] && CRYING_FIELD.has(wordOf(tokens[j]))) return 'tear';
    }
  }

  // Otherwise the unmarked /tɛər/: the rip verb or a rip/rent.
  return 'taer';
}
