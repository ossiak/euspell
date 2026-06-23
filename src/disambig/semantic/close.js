/**
 * Disambiguates 'close': /kloʊs/ (with /s/, rhymes with "dose" → 'close' — the
 * adjective/adverb meaning near: "close to", "close friend", "stood close") vs
 * /kloʊz/ (with /z/, rhymes with "doze" → 'cloze' — the verb meaning to shut:
 * "close the door", "close your eyes", "close down"). Corpus: disambig/close.txt
 *
 * This is a grammatical split (modifier vs verb), and the adjective/adverb sense
 * dominates, so 'close' is the unmarked default. 'cloze' is taken on positive
 * verb evidence inferred from neighbours: a following object (a determiner,
 * possessive or object pronoun) or particle ("close the/your eyes", "close
 * down"), or a preceding infinitive "to", modal or do-support ("to close",
 * "would close"). Conversely a following "to"/adverbial/head-noun, or a
 * preceding intensifier/copula/motion verb, fixes the modifier sense. The
 * decision rests only on neighbouring words, never the target's own
 * JJ|NN1|RR|VV0 tag (which always matches a verb).
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Right of "close": words that make the modifier sense (near). "to" leads the
// "close to" phrase; the rest are adverbials and adjective head nouns.
const ADJ_FOLLOW = new Set([
  'to', 'as', 'enough', 'by', 'behind', 'together', 'beside', 'around', 'against',
  'upon',
  'friend', 'friends', 'call', 'calls', 'range', 'quarters', 'combat', 'proximity',
  'contact', 'relationship', 'relationships', 'relation', 'relations', 'second',
  'seconds', 'shave', 'encounter', 'encounters', 'race', 'relative', 'relatives',
  'family', 'attention', 'watch', 'vicinity', 'thing', 'things', 'terms', 'orbit',
  'shot', 'shots', 'scrutiny', 'companion', 'companions', 'ally', 'allies', 'bond',
]);

// Right of "close": an object NP or particle that makes it the transitive verb
// (to shut). "this"/"that" are excluded — "so close that I cried" is the adverb.
const VERB_FOLLOW = new Set([
  'the', 'a', 'an', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'it',
  'them', "'em", 'down', 'up', 'off',
]);

// Left of "close": markers of the verb (infinitive, modal, do-support, please).
const VERB_BEFORE = new Set([
  'to', 'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must',
  'do', 'does', 'did', "don't", "doesn't", "didn't", "won't", "wouldn't", "can't",
  "couldn't", "shouldn't", 'please', 'help', 'helped', 'let', 'gonna', 'cannot',
]);

// Left of "close": intensifiers, copulas and motion verbs that take the
// predicative modifier (near) — "very close", "got close", "was close".
const ADJ_BEFORE = new Set([
  'very', 'so', 'too', 'quite', 'how', 'as', 'more', 'most', 'extremely', 'fairly',
  'pretty', 'real', 'really', 'incredibly', 'startlingly', 'remotely', 'surprisingly',
  'dangerously', 'perilously', 'awfully', 'mighty', 'ever', 'even', 'now', 'somewhere',
  'surely', 'usually', 'always', 'bit', 'seen', 'see', 'view', 'viewed', 'from',
  'photographed', 'filmed', 'examined', 'studied', 'observed', 'inspected',
  'get', 'gets', 'got', 'getting', 'gotten', 'come',
  'comes', 'came', 'coming', 'draw', 'draws', 'drew', 'drawn', 'drawing', 'move',
  'moves', 'moved', 'moving', 'stand', 'stands', 'stood', 'standing', 'stay', 'stays',
  'stayed', 'staying', 'keep', 'keeps', 'kept', 'hold', 'holds', 'held', 'sit', 'sits',
  'sat', 'sitting', 'remain', 'remains', 'remained', 'seem', 'seems', 'seemed', 'feel',
  'feels', 'felt', 'look', 'looks', 'looked', 'is', 'was', 'are', 'were', 'be', 'been',
  'being', 'am', 'pull', 'pulled', 'pulling', 'edge', 'edged', 'edging', 'press',
  'pressed', 'pressing', 'lean', 'leaned', 'leaning', 'huddle', 'huddled', 'hug',
  'hugged', 'nice', 'nicely', 'pressed', 'drift', 'drifted', 'crept', 'creep',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'close' | 'cloze'}
 */
export function disambiguate_close(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  const next = wordOf(tokens[idx + 1]);

  // A following modifier cue (close to / close friend / close enough) wins first,
  // so "to close quarters" stays the adjective despite the preceding "to".
  if (ADJ_FOLLOW.has(next)) return 'close';
  // A preceding intensifier/copula/comparative/motion verb marks the modifier
  // (very/got/was/as close) — checked before the following-object cue so that
  // "as close a site" and "is close up" stay the adjective, not a verb.
  if (ADJ_BEFORE.has(prev)) return 'close';
  // A preceding infinitive/modal/do-support marks the verb (to close, would close).
  if (VERB_BEFORE.has(prev)) return 'cloze';
  // A following object or particle marks the transitive verb (close the door).
  if (VERB_FOLLOW.has(next)) return 'cloze';

  // Otherwise the unmarked /kloʊs/ modifier sense.
  return 'close';
}
