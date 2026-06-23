/**
 * Disambiguates 'primate': /ˈpraɪmeɪt/ (rhymes with "mate" → 'primate' — the
 * mammal order: monkeys, apes, humans) vs /ˈpraɪmət/ (→ 'primat' — the
 * ecclesiastical title: a senior archbishop, "the Primate of All England").
 * Corpus: disambig/primate.txt
 *
 * The biological sense overwhelmingly dominates ("the primate", "primate
 * species/research", "large primate"), so 'primate' is the unmarked default.
 * 'primat' is the archbishop, taken only with church/clergy evidence in the
 * clause (archbishop, bishop, cathedral, Canterbury, "of All England"…). The
 * decision rests only on neighbouring words, never the target's own NN1 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Anywhere in the clause window: church / clergy vocabulary, which marks the
// archbishop title → /ˈpraɪmət/ ('primat'). Plus the specific primatial sees.
const CHURCH_FIELD = new Set([
  'archbishop', 'archbishops', 'bishop', 'bishops', 'bishopric', 'cardinal',
  'cardinals', 'church', 'churches', 'cathedral', 'diocese', 'dioceses', 'clergy',
  'clergyman', 'clergymen', 'priest', 'priests', 'priesthood', 'pope', 'papal',
  'papacy', 'ecclesiastical', 'ecclesiastic', 'reverend', 'consecrated',
  'consecration', 'primacy', 'primatial', 'abbot', 'parish', 'anglican',
  'catholic', 'episcopal', 'episcopate', 'prelate', 'prelates', 'metropolitan',
  'vatican', 'christendom', 'apostolic', 'canterbury', 'armagh', 'york',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'primat' | 'primate'}
 */
export function disambiguate_primate(tokens, idx) {
  // "Lord Primate" — the archbishop style of address.
  if (wordOf(tokens[idx - 1]) === 'lord') return 'primat';

  // "Primate of All England / of Ireland" — the title's territorial form.
  // ("of all" alone is too loose — cf. "the finest primate of all").
  const SEE = new Set(['england', 'ireland']);
  if (wordOf(tokens[idx + 1]) === 'of' &&
      (SEE.has(wordOf(tokens[idx + 2])) ||
        (wordOf(tokens[idx + 2]) === 'all' && SEE.has(wordOf(tokens[idx + 3]))))) {
    return 'primat';
  }

  // Church / clergy vocabulary in the clause → the archbishop, /ˈpraɪmət/.
  for (let j = idx - 6; j <= idx + 6; j++) {
    if (j !== idx && tokens[j] && CHURCH_FIELD.has(wordOf(tokens[j]))) return 'primat';
  }

  // Otherwise the unmarked /ˈpraɪmeɪt/: the mammal.
  return 'primate';
}
