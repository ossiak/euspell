/**
 * Disambiguates 'primates' (plural of primate): /ˈpraɪmeɪts/ (rhymes with
 * "mates" → 'primates' — the mammal order: monkeys, apes, humans) vs
 * /ˈpraɪməts/ (→ 'primats' — the ecclesiastical title: senior archbishops, "the
 * Primates of the Anglican Communion"). Corpus: disambig/primates.txt
 *
 * The biological sense dominates entirely, so 'primates' is the unmarked
 * default. 'primats' is the archbishops, taken only with church/clergy evidence
 * in the clause (archbishop, bishop, synod, Anglican Communion…). The decision
 * rests only on neighbouring words, never the target's own NN2 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Anywhere in the clause window: church / clergy vocabulary, which marks the
// archbishops → /ˈpraɪməts/ ('primats').
const CHURCH_FIELD = new Set([
  'archbishop', 'archbishops', 'bishop', 'bishops', 'bishopric', 'cardinal',
  'cardinals', 'church', 'churches', 'cathedral', 'diocese', 'dioceses', 'clergy',
  'clergyman', 'clergymen', 'priest', 'priests', 'priesthood', 'pope', 'papal',
  'papacy', 'ecclesiastical', 'ecclesiastic', 'reverend', 'consecrated',
  'consecration', 'primacy', 'primatial', 'abbot', 'parish', 'anglican',
  'catholic', 'episcopal', 'episcopate', 'prelate', 'prelates', 'metropolitan',
  'vatican', 'christendom', 'apostolic', 'canterbury', 'armagh', 'york', 'synod',
  'communion',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'primats' | 'primates'}
 */
export function disambiguate_primates(tokens, idx) {
  // Church / clergy vocabulary in the clause → the archbishops, /ˈpraɪməts/.
  for (let j = idx - 6; j <= idx + 6; j++) {
    if (j !== idx && tokens[j] && CHURCH_FIELD.has(wordOf(tokens[j]))) return 'primats';
  }

  // Otherwise the unmarked /ˈpraɪmeɪts/: the mammals.
  return 'primates';
}
